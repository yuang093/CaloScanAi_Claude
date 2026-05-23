import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '../../data/caloscanai.db');

// 取得本地時區的今天日期 (YYYY-MM-DD)
function getLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localDate = new Date(now.getTime() - offset);
  return localDate.toISOString().split('T')[0];
}

// Ensure data directory exists
import fs from 'fs';
const dataDir = join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;
try {
  db = new Database(dbPath);
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
} catch (err) {
  console.error('❌ 無法建立資料庫連線:', err.message);
  process.exit(1);
}

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema with error handling
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS food_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      image_data TEXT,
      meal_type TEXT DEFAULT 'general',
      calories INTEGER DEFAULT 0,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fat REAL DEFAULT 0,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_calories INTEGER DEFAULT 0,
      total_protein REAL DEFAULT 0,
      total_carbs REAL DEFAULT 0,
      total_fat REAL DEFAULT 0,
      goal_calories INTEGER DEFAULT 2000,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, date)
    );

    CREATE TABLE IF NOT EXISTS daily_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote TEXT NOT NULL,
      author TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS barcodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      calories INTEGER DEFAULT 0,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fat REAL DEFAULT 0,
      serving_size TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      weight REAL,
      height REAL,
      age INTEGER,
      gender TEXT DEFAULT 'unspecified',
      activity_level TEXT DEFAULT 'sedentary',
      goal_calories INTEGER DEFAULT 2000,
      custom_bmr REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
} catch (err) {
  console.error('❌ 資料庫結構初始化失敗:', err.message);
  process.exit(1);
}

// ALTER TABLE for role column (SQLite doesn't auto-add to existing tables)
try {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin'))");
} catch (err) {
  // Column may already exist, ignore error
  if (!err.message.includes('duplicate column name')) {
    console.warn('⚠️ users.role 欄位設定警告:', err.message);
  }
}

// Migration: ensure username column exists
try {
  const pragma = db.prepare("PRAGMA table_info(users)").all();
  const columns = pragma.map(c => c.name);

  // 如果沒有 username 欄位，就新增
  if (!columns.includes('username')) {
    db.exec("ALTER TABLE users ADD COLUMN username TEXT");
    // 如果有 email 欄位，把資料拷貝過來
    if (columns.includes('email')) {
      db.exec("UPDATE users SET username = email WHERE username IS NULL");
    }
    console.log('✅ 資料庫遷移完成: 新增 username 欄位');
  }
} catch (err) {
  console.warn('⚠️ 資料庫遷移警告:', err.message);
}

// Create indexes
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_food_logs_user_id ON food_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_food_logs_created_at ON food_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_daily_progress_user_date ON daily_progress(user_id, date);
  `);
} catch (err) {
  console.error('❌ 索引建立失敗:', err.message);
  process.exit(1);
}

// Seed default daily quotes if empty
const quoteCount = db.prepare('SELECT COUNT(*) as count FROM daily_quotes').get();
if (quoteCount.count === 0) {
  const defaultQuotes = [
    // 健康與飲食習慣 (1-50)
    ['每天進步一點點，成就不一樣的自己。', '佚名'],
    ['食物是燃料，選擇好的燃料讓你更有活力。', '營養師'],
    ['健康不是目的，而是生活的態度。', '佚名'],
    ['每一餐都是愛護自己的機會。', '佚名'],
    ['持之以恆，你正在改變自己的未來。', '佚名'],
    ['吃對食物，讓身體感謝你。', '佚名'],
    ['營養均衡是健康的基礎。', '營養師'],
    ['不要飢餓減肥，要智慧減脂。', '佚名'],
    ['慢食細嚥，享受每一口。', '佚名'],
    ['水是最好的減肥飲料。', '佚名'],
    ['蔬菜是餐盤的主角。', '營養師'],
    ['蛋白質是肌肉的建築師。', '佚名'],
    ['健康飲食不是節食，而是選擇。', '佚名'],
    ['讓食物成為你的藥物。', '佚名'],
    ['每天一份水果，活力滿滿。', '佚名'],
    ['早餐是一天中最重要的一餐。', '佚名'],
    ['不要跳過任何一餐。', '營養師'],
    ['吃真正的食物，不是加工食品。', '佚名'],
    ['纖維讓你更有飽足感。', '佚名'],
    ['健康的腸道，快樂的你。', '佚名'],
    ['Omega-3 讓大腦更靈活。', '佚名'],
    ['鈣質強化你的骨骼。', '佚名'],
    ['鐵質讓你更有血色。', '佚名'],
    ['維生素D 來自陽光和食物。', '佚名'],
    ['少鹽少糖，血壓更穩定。', '佚名'],
    ['控制份量，輕鬆減脂。', '佚名'],
    ['記錄飲食，掌握熱量。', '佚名'],
    ['廚房是自己最好的實驗室。', '佚名'],
    ['自煮一族，健康我有。', '佚名'],
    ['選擇全穀，拒絕精製。', '佚名'],
    ['好脂肪讓你更聰明。', '佚名'],
    ['堅果是天然的能量棒。', '佚名'],
    ['綠茶幫助新陳代謝。', '佚名'],
    ['洋蔥大蒜是天然抗生素。', '佚名'],
    ['薑黃是超級香料。', '佚名'],
    ['綠色蔬菜是你的好朋友。', '佚名'],
    ['橙色蔬菜保護你的眼睛。', '佚名'],
    ['喝水而非含糖飲料。', '佚名'],
    ['慢慢減重，才能持久。', '佚名'],
    ['不要太嚴格，偶爾放縱是允許的。', '佚名'],
    ['計劃好你的飲食，成功一半。', '佚名'],
    ['不要在飢餓時購物。', '佚名'],
    ['閱讀食品標籤，做聰明消費者。', '佚名'],
    ['新鮮食材是首選。', '佚名'],
    ['自己煮飯掌控熱量。', '佚名'],
    ['避免吃到飽的自助餐。', '佚名'],
    ['用小碗吃小份量。', '佚名'],
    ['專心吃飯，不要邊吃邊看手機。', '佚名'],
    ['晚上八點後盡量不進食。', '佚名'],
    ['讓你的餐盤像彩虹。', '佚名'],

    // 運動與生活 (51-100)
    ['運動是減脂的最佳幫手。', '佚名'],
    ['久坐一小時，站起來動一動。', '佚名'],
    ['走路是最簡單的運動。', '佚名'],
    ['每天萬步，健康有保固。', '佚名'],
    ['肌力訓練讓你更緊實。', '佚名'],
    ['核心訓練是健康的基礎。', '佚名'],
    ['伸展讓你更靈活。', '佚名'],
    ['運動後要補充蛋白質。', '佚名'],
    ['休息也是訓練的一部分。', '佚名'],
    ['不要比較，每個人體質不同。', '佚名'],
    ['找到你喜歡的運動。', '佚名'],
    ['動起來就對了。', '佚名'],
    ['運動釋放腦內啡，快樂自然來。', '佚名'],
    ['流汗是健康的象徵。', '佚名'],
    ['晨運讓你整天有精神。', '佚名'],
    ['運動提升你的新陳代謝。', '佚名'],
    ['肌肉燃燒的熱量比脂肪多。', '佚名'],
    [' HIIT 是時間緊張者的救星。', '佚名'],
    ['瑜伽讓身心靈平衡。', '佚名'],
    ['游泳是全身運動。', '佚名'],
    ['騎腳踏車環保又健康。', '佚名'],
    ['樓梯是你的好友。', '佚名'],
    ['站著工作燃燒更多熱量。', '佚名'],
    ['運動讓你晚上更好睡。', '佚名'],
    ['保持活躍的生活型態。', '佚名'],
    ['運動不只是減脂，更是投資健康。', '佚名'],
    ['每天十分鐘，累積大效果。', '佚名'],
    ['選擇階梯而非電梯。', '佚名'],
    ['提前一站下公車走路。', '佚名'],
    ['邊看電視邊做伸展。', '佚名'],
    ['運動前補充水分。', '佚名'],
    ['運動後要拉筋放鬆。', '佚名'],
    ['漸進式增加訓練強度。', '佚名'],
    ['給身體時間恢復。', '佚名'],
    ['運動是對自己的愛。', '佚名'],
    ['流汗過後皮膚會變好。', '佚名'],
    ['運動提升自信心。', '佚名'],
    ['設定運動目標，追蹤進度。', '佚名'],
    ['找運動夥伴互相激勵。', '佚名'],
    ['雨天改成室內運動。', '佚名'],
    ['音樂讓運動更有趣。', '佚名'],
    ['穿戴裝置記錄你的進步。', '佚名'],
    ['不要只在週末才運動。', '佚名'],
    ['每天累積30分鐘運動。', '佚名'],
    ['運動是最好的抗老良藥。', '佚名'],
    ['讓身體習慣動的感覺。', '佚名'],
    ['打破慣性，嘗試新運動。', '佚名'],
    ['運動時注意姿勢。', '佚名'],
    ['正確姿勢預防受傷。', '佚名'],
    ['熱身運動不可少。', '佚名'],

    // 心理與態度 (101-150)
    ['減脂是馬拉松，不是短跑。', '佚名'],
    ['耐心是減脂的關鍵。', '佚名'],
    ['相信自己可以做得到。', '佚名'],
    ['不要放棄，你正在進步。', '佚名'],
    ['每一個小進步都值得慶祝。', '佚名'],
    ['失敗只是成功的墊腳石。', '佚名'],
    ['減脂是為了更健康的自己。', '佚名'],
    ['愛自己現在的樣子。', '佚名'],
    ['改變需要時間，給自己耐心。', '佚名'],
    ['專注在感覺，不是數字。', '佚名'],
    ['體重不是唯一的指標。', '佚名'],
    ['感受身體的變化。', '佚名'],
    ['衣服變鬆是成功的跡象。', '佚名'],
    ['精神變好是最大的收穫。', '佚名'],
    ['睡得好才能瘦得好。', '佚名'],
    ['壓力會影響體重。', '佚名'],
    ['冥想幫助控制食慾。', '佚名'],
    ['充足的睡眠很重要。', '佚名'],
    ['睡眠不足會讓你更餓。', '佚名'],
    ['每天七到八小時睡眠。', '佚名'],
    ['睡前避免藍光。', '佚名'],
    ['寫飲食日記了解自己。', '佚名'],
    ['不要因為一次失控就放棄。', '佚名'],
    ['明天是新的開始。', '佚名'],
    ['對自己寬鬆一點。', '佚名'],
    ['慶祝每一個小成功。', '佚名'],
    ['你的努力值得肯定。', '佚名'],
    ['健康是一輩子的事業。', '佚名'],
    ['不要追求速效減肥。', '佚名'],
    ['每週減少0.5-1公斤是健康的速度。', '佚名'],
    ['慢慢來，比較快。', '佚名'],
    ['設定可達成的目標。', '佚名'],
    ['減脂不能靠飢餓。', '佚名'],
    ['吃足夠才能健康的瘦。', '佚名'],
    ['你的身體會感謝你的努力。', '佚名'],
    ['減脂是學校的旅程。', '佚名'],
    ['享受過程，不要只看重結果。', '佚名'],
    ['健康的生活讓你更快樂。', '佚名'],
    ['每一天都是改變的機會。', '佚名'],
    ['你可以做到的。', '佚名'],
    ['相信這個過程。', '佚名'],
    ['你比你想像的更有紀律。', '佚名'],
    ['減脂是給自己的禮物。', '佚名'],
    ['為健康投資，永遠不嫌晚。', '佚名'],
    ['開始就不嫌晚。', '佚名'],
    ['今天的選擇決定明天的你。', '佚名'],
    ['專注在長遠的目標。', '佚名'],
    ['不要被短期波動影響。', '佚名'],
    ['你的堅持會有回報的。', '佚名'],

    // 習慣與技巧 (151-200)
    ['先喝一杯水再吃早餐。', '佚名'],
    ['飯前喝湯減少食量。', '佚名'],
    ['蔬菜先吃，蛋白質次之。', '佚名'],
    ['細嚼慢嚥每口食物。', '佚名'],
    ['用非主要手吃東西減慢速度。', '佚名'],
    ['每餐時間至少20分鐘。', '佚名'],
    ['寫下你的飢餓程度。', '佚名'],
    ['等十分鐘再決定要不要吃。', '佚名'],
    ['找到情緒性進食的觸發點。', '佚名'],
    ['用散步代替零食。', '佚名'],
    ['更換興趣轉移注意力。', '佚名'],
    ['清理家中的誘惑食物。', '佚名'],
    ['購物前列好清單。', '佚名'],
    ['不要在飢餓時去超市。', '佚名'],
    ['選擇小包裝的零食。', '佚名'],
    ['用水果代替甜點。', '佚名'],
    ['希臘酸奶是優質蛋白質。', '佚名'],
    ['雞胸肉是減脂好幫手。', '佚名'],
    ['魚肉是優質蛋白質來源。', '佚名'],
    ['豆腐是植物性蛋白質。', '佚名'],
    ['雞蛋是完美的蛋白質。', '佚名'],
    ['多吃顏色鮮豔的蔬菜。', '佚名'],
    ['黑咖啡熱量低。', '佚名'],
    ['無糖茶類幫助消脂。', '佚名'],
    ['檸檬水增加維生素C。', '佚名'],
    ['早起喝溫水促進排便。', '佚名'],
    ['養成吃早餐的習慣。', '佚名'],
    ['把零食放在不容易拿到的地方。', '佚名'],
    ['吃東西時關掉電視。', '佚名'],
    ['專心吃飯體驗食物美味。', '佚名'],
    ['飯後散步幫助消化。', '佚名'],
    ['飯後半小時再喝茶。', '佚名'],
    ['睡前兩小時不進食。', '佚名'],
    ['養成記錄的習慣。', '佚名'],
    ['每週一次體重測量。', '佚名'],
    ['測量腰圍追蹤進度。', '佚名'],
    ['拍照記錄身體變化。', '佚名'],
    ['衣服變大是進步的證明。', '佚名'],
    ['定期檢視飲食計劃。', '佚名'],
    ['適度調整目標。', '佚名'],
    ['找到適合自己的方式。', '佚名'],
    ['不要抄襲别人的飲食。', '佚名'],
    ['適合别人的不一定適合你。', '佚名'],
    ['聆聽身體的聲音。', '佚名'],
    ['飢餓感是身體的訊號。', '佚名'],
    ['飽了就停下來。', '佚名'],
    ['品嚐食物的風味。', '佚名'],

    // 特殊情境 (201-250)
    ['聚會前先吃健康的食物。', '佚名'],
    ['派對上選擇蛋白質食物。', '佚名'],
    ['派對上站著聊天消耗熱量。', '佚名'],
    ['選擇小盘子取餐。', '佚名'],
    ['先觀察餐點再決定。', '佚名'],
    ['選擇清蒸而非油炸。', '佚名'],
    ['去頭去皮減少熱量。', '佚名'],
    ['選擇無糖飲料。', '佚名'],
    ['酒類熱量高要節制。', '佚名'],
    ['甜點淺嚐即可。', '佚名'],
    ['選擇水果而非蛋糕。', '佚名'],
    ['節日享受但要節制。', '佚名'],
    ['旅行時保持正常作息。', '佚名'],
    ['選擇當地蔬果食材。', '佚名'],
    ['逛街取代美食行程。', '佚名'],
    ['飯店健身房善加利用。', '佚名'],
    ['攜帶健康零食備用。', '佚名'],
    ['提前計劃避免亂吃。', '佚名'],
    ['工作忙碌也要吃飯。', '佚名'],
    ['辦公室午餐選擇健康餐。', '佚名'],
    ['自己帶午餐控制熱量。', '佚名'],
    ['避免下午茶的誘惑。', '佚名'],
    ['用水果取代糕點。', '佚名'],
    ['選擇走樓梯而非坐電梯。', '佚名'],
    ['午休散步助消化。', '佚名'],
    ['壓力大時別用食物發洩。', '佚名'],
    ['運動釋放壓力。', '佚名'],
    ['睡前放鬆幫助睡眠。', '佚名'],
    ['月經前容易飢餓是正常的。', '佚名'],
    ['更年期間新陳代謝改變。', '佚名'],
    ['產後減脂要慢慢來。', '佚名'],
    ['哺乳的熱量消耗很大。', '佚名'],
    ['疾病康復需要營養。', '佚名'],
    ['手術後不要急著減肥。', '佚名'],
    ['青少年發育期不要過度節食。', '佚名'],
    ['發育期需要充足營養。', '佚名'],
    ['考生需要好腦力。', '佚名'],
    ['考生也需要休息和運動。', '佚名'],
    ['春節連假注意熱量控制。', '佚名'],
    ['過年零食淺嚐即止。', '佚名'],
    ['端午節粽子一顆足矣。', '佚名'],
    ['月餅熱量高要節制。', '佚名'],
    ['中秋烤肉選擇瘦肉。', '佚名'],
    ['冬至湯圓要注意份量。', '佚名'],
    ['尾牙春酒聰明吃。', '佚名'],
    ['吃到飽餐廳選擇順序。', '佚名'],
    ['火鍋湯底熱量高。', '佚名'],
    ['火鍋料選擇原型食物。', '佚名'],

    // 進階知識 (251-300)
    ['基礎代謝占每日消耗60-70%。', '佚名'],
    ['肌肉燃燒的熱量是脂肪的10倍。', '佚名'],
    ['蛋白質的食物熱效應最高。', '佚名'],
    ['碳水化合物是運動的能量來源。', '佚名'],
    ['脂肪讓食物更美味。', '佚名'],
    ['膽固醇有分好與壞。', '佚名'],
    ['HDL是好的膽固醇。', '佚名'],
    ['LDL是壞的膽固醇。', '佚名'],
    ['飽和脂肪對心臟不好。', '佚名'],
    ['不飽和脂肪是健康的選擇。', '佚名'],
    ['反式脂肪應該避免。', '佚名'],
    ['Omega-3 保護心臟。', '佚名'],
    ['膳食纖維有益腸道健康。', '佚名'],
    ['水溶性纖維降低膽固醇。', '佚名'],
    ['非水溶性纖維幫助排便。', '佚名'],
    ['益生菌維持腸道平衡。', '佚名'],
    ['發酵食品是益生菌來源。', '佚名'],
    ['維生素B群幫助代謝。', '佚名'],
    ['維生素C增強免疫力。', '佚名'],
    ['維生素E保護細胞。', '佚名'],
    ['鐵質缺乏會頭暈。', '佚名'],
    ['鈣質強化骨骼。', '佚名'],
    ['鋅提升免疫力。', '佚名'],
    ['鎂幫助肌肉放鬆。', '佚名'],
    ['鉀調節血壓。', '佚名'],
    ['鈉攝取過多血壓高。', '佚名'],
    ['GI值影響血糖波動。', '佚名'],
    ['低GI食物讓你更飽。', '佚名'],
    ['GL負擔指數更準確。', '佚名'],
    ['胰島素影響脂肪儲存。', '佚名'],
    ['胰島素阻抗影響減脂。', '佚名'],
    ['皮質醇壓力荷爾蒙。', '佚名'],
    ['睡眠不足提高皮質醇。', '佚名'],
    ['甲狀腺影響新陳代謝。', '佚名'],
    ['甲狀腺低下會發胖。', '佚名'],
    ['新腎上腺素幫助燃脂。', '佚名'],
    ['生長激素促進肌肉生長。', '佚名'],
    ['睪酮影響肌肉發展。', '佚名'],
    ['雌激素影響水分滯留。', '佚名'],
    ['賀爾蒙影響體重。', '佚名'],
    ['熱量赤字才能減脂。', '佚名'],
    ['3500大卡等於一磅脂肪。', '佚名'],
    ['每日赤字500大卡一週減半公斤。', '佚名'],
    ['身體適應會影響減脂速度。', '佚名'],
    ['減脂到最後最難。', '佚名'],
    ['停滯期是正常的。', '佚名'],
    ['改變訓練突破停滯。', '佚名'],
    ['改變飲食突破停滯。', '佚名'],
    ['欺騙餐恢復代謝。', '佚名'],
    [' carb cycling 調整法。', '佚名'],

    // 激勵語 (301-365)
    ['你值得擁有健康的身體。', '佚名'],
    ['現在開始永遠不嫌晚。', '佚名'],
    ['今天的努力是明天的收穫。', '佚名'],
    ['你比自己想像的更強大。', '佚名'],
    ['減脂是給自己的情書。', '佚名'],
    ['投資自己的健康。', '佚名'],
    ['你的身體是你的聖殿。', '佚名'],
    ['愛護它，呵護它。', '佚名'],
    ['健康是最大的財富。', '佚名'],
    ['沒有健康，其他都是零。', '佚名'],
    ['你選擇今天吃什麼，就是選擇明天成為什麼樣的人。', '佚名'],
    ['每一次正確的選擇都在改變你。', '佚名'],
    ['不要等待，改變從現在開始。', '佚名'],
    ['你值得遇見更好的自己。', '佚名'],
    ['每一天都是嶄新的開始。', '佚名'],
    ['相信這個過程。', '佚名'],
    ['你正在做的事很重要。', '佚名'],
    ['不放棄，直到成功。', '佚名'],
    ['小小的改變，大大的不同。', '佚名'],
    ['健康讓生活更美好。', '佚名'],
    ['你的潛力無窮。', '佚名'],
    ['只有你自己能定義自己。', '佚名'],
    ['今天走過的路會成就明天的你。', '佚名'],
    ['慶祝每一個小小的進步。', '佚名'],
    ['你正在戰鬥，你已經是贏家。', '佚名'],
    ['勇敢做出改變。', '佚名'],
    ['你的決心比困難更強大。', '佚名'],
    ['每天都比昨天更好。', '佚名'],
    ['一步一步，你正在接近目標。', '佚名'],
    ['你值得為自己感到驕傲。', '佚名'],
    ['成功的關鍵是堅持。', '佚名'],
    ['你比食物更有控制力。', '佚名'],
    ['你可以拒絕誘惑。', '佚名'],
    ['你比你以為的更有意志力。', '佚名'],
    ['這一切都是值得的。', '佚名'],
    ['你的努力不會白費。', '佚名'],
    ['健康快樂是最終目標。', '佚名'],
    ['享受這個旅程。', '佚名'],
    ['你並不孤單。', '佚名'],
    ['我們都在這條路上。', '佚名'],
    ['互相鼓勵一起前進。', '佚名'],
    ['分享你的成功。', '佚名'],
    ['鼓勵身邊的人。', '佚名'],
    ['幫助別人就是幫助自己。', '佚名'],
    ['讓更多人變健康。', '佚名'],
    ['這是長期抗戰。', '佚名'],
    ['但你已經在贏的路上了。', '佚名'],
    ['繼續前進。', '佚名'],
    ['你做得到的。', '佚名'],
    ['減脂快樂，快樂減脂。', '佚名'],
    ['健康生活是一種慶祝。', '佚名'],
    ['享受食物，享受生活。', '佚名'],
    ['平衡是關鍵。', '佚名'],
    ['太嚴格只會反效果。', '佚名'],
    ['偶爾放縱是允許的。', '佚名'],
    ['不要太苛刻自己。', '佚名'],
    ['你已經很好了。', '佚名'],
    ['但你還可以更好。', '佚名'],
    ['這就是成長。', '佚名'],
    ['每一天都是新的學習。', '佚名'],
    ['健康是每天的功課。', '佚名'],
    ['做功課不考試。', '佚名'],
    ['讓健康成為習慣。', '佚名'],
    ['讓習慣成為自然。', '佚名'],
    ['你正在培養好習慣。', '佚名'],
    ['好習慣會跟隨你一輩子。', '佚名'],
  ];

  const insertQuote = db.prepare('INSERT INTO daily_quotes (quote, author) VALUES (?, ?)');
  for (const quote of defaultQuotes) {
    insertQuote.run(...quote);
  }
  console.log('✅ 已插入 ' + defaultQuotes.length + ' 筆預設勵志語');
}

// User operations
export const UserDB = {
  create(username, password, name, role = 'user') {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)');
    const result = stmt.run(username, hashedPassword, name, role);
    return this.findById(result.lastInsertRowid);
  },

  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  findById(id) {
    return db.prepare('SELECT id, username, name, role, created_at FROM users WHERE id = ?').get(id);
  },

  verifyPassword(username, password) {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return null;
    if (!bcrypt.compareSync(password, user.password)) return null;
    return { id: user.id, username: user.username, name: user.name, role: user.role };
  },

  setAdmin(userId) {
    const stmt = db.prepare('UPDATE users SET role = ? WHERE id = ?');
    stmt.run('admin', userId);
  }
};

// Food log operations
export const FoodLogDB = {
  create(userId, data) {
    const stmt = db.prepare(`
      INSERT INTO food_logs (user_id, image_data, meal_type, calories, protein, carbs, fat, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      userId,
      data.imageData || null,
      data.mealType || 'general',
      data.calories || 0,
      data.protein || 0,
      data.carbs || 0,
      data.fat || 0,
      data.description || null
    );
    return this.findById(result.lastInsertRowid);
  },

  findById(id) {
    return db.prepare('SELECT * FROM food_logs WHERE id = ?').get(id);
  },

  findByUserId(userId, options = {}) {
    const { date, limit = 20, offset = 0 } = options;
    let query = 'SELECT * FROM food_logs WHERE user_id = ?';
    const params = [userId];

    if (date) {
      query += ' AND date(created_at) = ?';
      params.push(date);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = db.prepare(query).all(...params);
    const countQuery = db.prepare('SELECT COUNT(*) as total FROM food_logs WHERE user_id = ?' + (date ? ' AND date(created_at) = ?' : ''));
    const count = date
      ? countQuery.get(userId, date)
      : countQuery.get(userId);

    return { logs, total: count.total };
  },

  update(id, userId, data) {
    const fields = [];
    const values = [];

    if (data.mealType !== undefined) { fields.push('meal_type = ?'); values.push(data.mealType); }
    if (data.calories !== undefined) { fields.push('calories = ?'); values.push(data.calories); }
    if (data.protein !== undefined) { fields.push('protein = ?'); values.push(data.protein); }
    if (data.carbs !== undefined) { fields.push('carbs = ?'); values.push(data.carbs); }
    if (data.fat !== undefined) { fields.push('fat = ?'); values.push(data.fat); }

    if (fields.length === 0) return this.findById(id);

    values.push(id, userId);
    const stmt = db.prepare(`UPDATE food_logs SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`);
    stmt.run(...values);

    return this.findById(id);
  },

  delete(id, userId) {
    const stmt = db.prepare('DELETE FROM food_logs WHERE id = ? AND user_id = ?');
    const result = stmt.run(id, userId);
    return result.changes > 0;
  },

  getTodayStats(userId) {
    const today = getLocalDate();
    const stmt = db.prepare(`
      SELECT
        COALESCE(SUM(calories), 0) as total_calories,
        COALESCE(SUM(protein), 0) as total_protein,
        COALESCE(SUM(carbs), 0) as total_carbs,
        COALESCE(SUM(fat), 0) as total_fat,
        COUNT(*) as meal_count
      FROM food_logs
      WHERE user_id = ? AND date(created_at) = ?
    `);
    return stmt.get(userId, today);
  }
};

// Daily progress operations
export const DailyProgressDB = {
  upsert(userId, date, data) {
    const stmt = db.prepare(`
      INSERT INTO daily_progress (user_id, date, total_calories, total_protein, total_carbs, total_fat, goal_calories)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        total_calories = excluded.total_calories,
        total_protein = excluded.total_protein,
        total_carbs = excluded.total_carbs,
        total_fat = excluded.total_fat,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(
      userId,
      date,
      data.totalCalories || 0,
      data.totalProtein || 0,
      data.totalCarbs || 0,
      data.totalFat || 0,
      data.goalCalories || 2000
    );
    return this.findByUserAndDate(userId, date);
  },

  findByUserAndDate(userId, date) {
    return db.prepare('SELECT * FROM daily_progress WHERE user_id = ? AND date = ?').get(userId, date);
  },

  findByUserId(userId, options = {}) {
    const { startDate, endDate, limit = 30 } = options;
    let query = 'SELECT * FROM daily_progress WHERE user_id = ?';
    const params = [userId];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date DESC LIMIT ?';
    params.push(limit);

    return db.prepare(query).all(...params);
  }
};

// Daily quotes operations
export const QuoteDB = {
  getRandom() {
    return db.prepare('SELECT * FROM daily_quotes ORDER BY RANDOM() LIMIT 1').get();
  },

  getAll() {
    return db.prepare('SELECT * FROM daily_quotes ORDER BY id').all();
  }
};

// Barcode operations
export const BarcodeDB = {
  findByBarcode(barcode) {
    return db.prepare('SELECT * FROM barcodes WHERE barcode = ?').get(barcode);
  },

  create(data) {
    const stmt = db.prepare(`
      INSERT INTO barcodes (barcode, name, brand, calories, protein, carbs, fat, serving_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.barcode,
      data.name,
      data.brand || '未知',
      data.calories || 0,
      data.protein || 0,
      data.carbs || 0,
      data.fat || 0,
      data.servingSize || '未知'
    );
    return this.findByBarcode(data.barcode);
  },

  upsert(data) {
    const existing = this.findByBarcode(data.barcode);
    if (existing) {
      const stmt = db.prepare(`
        UPDATE barcodes SET name = ?, brand = ?, calories = ?, protein = ?, carbs = ?, fat = ?, serving_size = ?
        WHERE barcode = ?
      `);
      stmt.run(data.name, data.brand || '未知', data.calories || 0, data.protein || 0, data.carbs || 0, data.fat || 0, data.servingSize || '未知', data.barcode);
    } else {
      this.create(data);
    }
    return this.findByBarcode(data.barcode);
  }
};

// User profile operations
export const UserProfileDB = {
  upsert(userId, data) {
    // Get existing profile to preserve values if not provided
    const existing = this.findByUserId(userId);

    const weight = data.weight !== undefined ? data.weight : (existing?.weight ?? null);
    const height = data.height !== undefined ? data.height : (existing?.height ?? null);
    const age = data.age !== undefined ? data.age : (existing?.age ?? null);
    const gender = data.gender !== undefined ? data.gender : (existing?.gender ?? 'unspecified');
    const activityLevel = data.activityLevel !== undefined ? data.activityLevel : (existing?.activity_level ?? 'sedentary');
    const goalCalories = data.goalCalories !== undefined ? data.goalCalories : (existing?.goal_calories ?? 2000);
    const customBmr = data.customBmr !== undefined ? data.customBmr : (existing?.custom_bmr ?? null);

    const stmt = db.prepare(`
      INSERT INTO user_profiles (user_id, weight, height, age, gender, activity_level, goal_calories, custom_bmr)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        weight = excluded.weight,
        height = excluded.height,
        age = excluded.age,
        gender = excluded.gender,
        activity_level = excluded.activity_level,
        goal_calories = excluded.goal_calories,
        custom_bmr = excluded.custom_bmr,
        updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(userId, weight, height, age, gender, activityLevel, goalCalories, customBmr);
    return this.findByUserId(userId);
  },

  findByUserId(userId) {
    return db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(userId);
  },

  calculateBMR(profile) {
    if (!profile.weight || !profile.height || !profile.age) return null;

    if (profile.gender === 'male') {
      return 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
    } else if (profile.gender === 'female') {
      return 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
    }
    return 10 * profile.weight + 6.25 * profile.height - 5 * profile.age;
  },

  calculateTDEE(bmr, activityLevel) {
    const multipliers = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725
    };
    return Math.round(bmr * (multipliers[activityLevel] || 1.2));
  }
};

// Seed default barcodes if empty
const barcodeCount = db.prepare('SELECT COUNT(*) as count FROM barcodes').get();
if (barcodeCount.count === 0) {
  const defaultBarcodes = [
    { barcode: '4710138000014', name: '義美小泡芙', brand: '義美', calories: 140, protein: 2, carbs: 18, fat: 6, servingSize: '30g' },
    { barcode: '4710595600011', name: '泰山八寶粥', brand: '泰山', calories: 180, protein: 4, carbs: 30, fat: 4, servingSize: '250g' },
    { barcode: '4901234567890', name: '可口可樂', brand: '可口可樂', calories: 140, protein: 0, carbs: 35, fat: 0, servingSize: '330ml' },
    { barcode: '4712345678901', name: '乖乖', brand: '乖乖', calories: 200, protein: 3, carbs: 25, fat: 10, servingSize: '45g' },
    { barcode: '6920202888888', name: '維他奶', brand: '維他奶', calories: 100, protein: 5, carbs: 12, fat: 3, servingSize: '250ml' }
  ];

  for (const bc of defaultBarcodes) {
    BarcodeDB.create(bc);
  }
}

export default db;