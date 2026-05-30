// CaloScanAi PDF 報告產生器 - 六種格式
// 使用 html2canvas 轉圖片再轉 PDF，支援中文

const safeNum = (n) => n == null ? 0 : (isNaN(n) ? 0 : Number(n));
const safeDate = (d) => d == null ? '' : String(d);

function getLocalDateStr(date) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const taiwan = new Date(utc + (8 * 60 * 60 * 1000));
  const y = taiwan.getFullYear();
  const m = String(taiwan.getMonth() + 1).padStart(2, '0');
  const day = String(taiwan.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function calcStats(records) {
  const totalCal = records.reduce((sum, r) => sum + safeNum(r.total_calories), 0);
  const totalPro = records.reduce((sum, r) => sum + safeNum(r.total_protein), 0);
  const totalCarbs = records.reduce((sum, r) => sum + safeNum(r.total_carbs), 0);
  const totalFat = records.reduce((sum, r) => sum + safeNum(r.total_fat), 0);
  const len = records.length || 1;

  const totalProCal = totalPro * 4;
  const totalCarbsCal = totalCarbs * 4;
  const totalFatCal = totalFat * 9;
  const totalMacroCal = totalProCal + totalCarbsCal + totalFatCal;

  const maxCal = Math.max(...records.map(r => safeNum(r.total_calories)), 1);
  const minCal = Math.min(...records.map(r => safeNum(r.total_calories)), 1);

  return {
    avgCal: Math.round(totalCal / len),
    avgPro: Math.round(totalPro / len * 10) / 10,
    avgCarbs: Math.round(totalCarbs / len * 10) / 10,
    avgFat: Math.round(totalFat / len * 10) / 10,
    maxCal,
    minCal,
    totalDays: len,
    proPercent: totalMacroCal > 0 ? Math.round(totalProCal / totalMacroCal * 100) : 33,
    carbsPercent: totalMacroCal > 0 ? Math.round(totalCarbsCal / totalMacroCal * 100) : 33,
    fatPercent: totalMacroCal > 0 ? Math.round(totalFatCal / totalMacroCal * 100) : 34
  };
}

// ============================================================
// 格式二：卡片式（優化版 - 內容最豐富）
// ============================================================
function createStyle2HTML(stats, records, endDateStr) {
  const { avgCal, avgPro, avgCarbs, avgFat, maxCal, minCal, totalDays, proPercent, carbsPercent, fatPercent } = stats;

  // 計算近7天和近14天
  const recent7 = records.slice(0, 7);
  const recent14 = records.slice(0, 14);

  const calcWeekAvg = (weekRecords) => {
    const total = weekRecords.reduce((sum, r) => sum + safeNum(r.total_calories), 0);
    return Math.round(total / weekRecords.length);
  };

  const week1Avg = calcWeekAvg(recent7);
  const week2Avg = recent14.length >= 14 ? calcWeekAvg(recent14.slice(7, 14)) : week1Avg;
  const trend = week1Avg - week2Avg;

  return `
    <div style="width:148mm;min-height:210mm;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);font-family:'Noto Sans TC','PingFang TC','Microsoft JhengHei',Arial,sans-serif;padding:12mm 10mm;box-sizing:border-box;color:#1a1a2e;">
      <!-- 頁面頂部 -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:8px;border-bottom:2px solid #e0e7ff;">
        <div>
          <div style="font-size:14px;font-weight:700;color:#4f46e5;">CaloScanAi</div>
          <div style="font-size:8px;color:#6b7280;">智慧熱量追蹤系統</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:9px;color:#6b7280;">報表日期</div>
          <div style="font-size:10px;font-weight:600;color:#374151;">${endDateStr}</div>
        </div>
      </div>

      <!-- 標題 -->
      <div style="text-align:center;margin-bottom:10px;">
        <div style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:3px;">🍎 營養攝取報告</div>
        <div style="font-size:9px;color:#6b7280;">共 ${totalDays} 天資料統計</div>
      </div>

      <!-- 四大核心指標 -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:10px;">
        <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border-radius:8px;padding:8px 4px;text-align:center;">
          <div style="font-size:16px;margin-bottom:2px;">🔥</div>
          <div style="font-size:14px;font-weight:700;color:#d97706;">${avgCal}</div>
          <div style="font-size:7px;color:#92400e;">平均熱量 kcal</div>
        </div>
        <div style="background:linear-gradient(135deg,#dbeafe,#bfdbfe);border-radius:8px;padding:8px 4px;text-align:center;">
          <div style="font-size:16px;margin-bottom:2px;">💪</div>
          <div style="font-size:14px;font-weight:700;color:#2563eb;">${avgPro}g</div>
          <div style="font-size:7px;color:#1e40af;">蛋白質</div>
        </div>
        <div style="background:linear-gradient(135deg,#d1fae5,#a7f3d0);border-radius:8px;padding:8px 4px;text-align:center;">
          <div style="font-size:16px;margin-bottom:2px;">🍞</div>
          <div style="font-size:14px;font-weight:700;color:#059669;">${avgCarbs}g</div>
          <div style="font-size:7px;color:#047857;">碳水</div>
        </div>
        <div style="background:linear-gradient(135deg,#fce7f3,#fbcfe8);border-radius:8px;padding:8px 4px;text-align:center;">
          <div style="font-size:16px;margin-bottom:2px;">🥑</div>
          <div style="font-size:14px;font-weight:700;color:#db2777;">${avgFat}g</div>
          <div style="font-size:7px;color:#be185d;">脂肪</div>
        </div>
      </div>

      <!-- 熱量趨勢圖 -->
      <div style="background:white;border-radius:10px;padding:8px;margin-bottom:8px;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
        <div style="font-size:9px;font-weight:600;color:#374151;margin-bottom:6px;">📊 近7天熱量趨勢</div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;height:50px;padding:0 3px;">
          ${recent7.map((r, i) => {
            const h = Math.round((safeNum(r.total_calories) / (maxCal * 1.1)) * 42);
            const colors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e','#14b8a6','#3b82f6'];
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">
              <div style="width:100%;background:${colors[i]};border-radius:2px 2px 0 0;height:${h}px;min-height:3px;"></div>
              <div style="font-size:6px;color:#6b7280;">${safeDate(r.date).slice(5)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- 營養素比例 & 熱量統計 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
        <div style="background:white;border-radius:10px;padding:8px;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
          <div style="font-size:9px;font-weight:600;color:#374151;margin-bottom:6px;">🥗 三大營養素比例</div>
          <div style="display:flex;height:8px;border-radius:4px;overflow:hidden;margin-bottom:5px;">
            <div style="width:${proPercent}%;background:#3b82f6;"></div>
            <div style="width:${carbsPercent}%;background:#22c55e;"></div>
            <div style="width:${fatPercent}%;background:#f97316;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:7px;">
            <span style="color:#3b82f6;">● 蛋白 ${proPercent}%</span>
            <span style="color:#22c55e;">● 碳水 ${carbsPercent}%</span>
            <span style="color:#f97316;">● 脂肪 ${fatPercent}%</span>
          </div>
        </div>
        <div style="background:white;border-radius:10px;padding:8px;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
          <div style="font-size:9px;font-weight:600;color:#374151;margin-bottom:6px;">📈 熱量統計</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:8px;">
            <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">最高</span><span style="font-weight:600;color:#ef4444;">${maxCal}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">最低</span><span style="font-weight:600;color:#22c55e;">${minCal}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">本週均</span><span style="font-weight:600;color:#4f46e5;">${week1Avg}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#6b7280;">趨勢</span><span style="font-weight:600;color:${trend>=0?'#ef4444':'#22c55e'};">${trend>=0?'↑':'↓'}${Math.abs(trend)}</span></div>
          </div>
        </div>
      </div>

      <!-- 每日詳細記錄表 -->
      <div style="background:white;border-radius:10px;padding:8px;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
        <div style="font-size:9px;font-weight:600;color:#374151;margin-bottom:6px;">📋 每日記錄</div>
        <table style="width:100%;border-collapse:collapse;font-size:7px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:4px 2px;text-align:left;color:#64748b;font-weight:500;">日期</th>
              <th style="padding:4px 2px;text-align:right;color:#64748b;font-weight:500;">熱量</th>
              <th style="padding:4px 2px;text-align:right;color:#64748b;font-weight:500;">蛋白</th>
              <th style="padding:4px 2px;text-align:right;color:#64748b;font-weight:500;">碳水</th>
              <th style="padding:4px 2px;text-align:right;color:#64748b;font-weight:500;">脂肪</th>
            </tr>
          </thead>
          <tbody>
            ${records.slice(0, 20).map((r, i) => {
              const dayNames = ['日','一','二','三','四','五','六'];
              const d = new Date(r.date);
              const dayName = dayNames[d.getDay()];
              const calColor = safeNum(r.total_calories) > avgCal * 1.2 ? '#ef4444' : safeNum(r.total_calories) < avgCal * 0.8 ? '#22c55e' : '#374151';
              return `
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:4px 2px;">
                  <span style="color:#64748b;">${safeDate(r.date).slice(5)}</span>
                  <span style="color:#94a3b8;font-size:6px;">(${dayName})</span>
                </td>
                <td style="padding:4px 2px;text-align:right;font-weight:600;color:${calColor};">${safeNum(r.total_calories)}</td>
                <td style="padding:4px 2px;text-align:right;color:#64748b;">${safeNum(r.total_protein)}g</td>
                <td style="padding:4px 2px;text-align:right;color:#64748b;">${safeNum(r.total_carbs)}g</td>
                <td style="padding:4px 2px;text-align:right;color:#64748b;">${safeNum(r.total_fat)}g</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- 頁尾 -->
      <div style="text-align:center;margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;">
        <div style="font-size:8px;color:#9ca3af;">✨ 由 CaloScanAi 自動生成 ✨</div>
        <div style="font-size:6px;color:#d1d5db;margin-top:2px;">Calorie Tracking with AI Vision</div>
      </div>
    </div>
  `;
}

// ============================================================
// 其他格式 (簡化版)
// ============================================================
function createStyle1HTML(stats, records, endDateStr) {
  const { avgCal, avgPro, avgCarbs, avgFat } = stats;
  return `
    <div style="width:148mm;min-height:210mm;background:white;padding:12mm 10mm;font-family:'Noto Sans TC',Arial,sans-serif;">
      <div style="font-size:16px;color:#2d6a4f;border-bottom:2px solid #2d6a4f;padding-bottom:6px;margin-bottom:10px;">CaloScanAi 健康報表</div>
      <div style="font-size:9px;color:#666;margin-bottom:12px;">${endDateStr} | 近${records.length}天</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;">
        <div style="background:#f0f9f4;padding:8px;border-radius:5px;text-align:center;border-left:2px solid #2d6a4f;"><div style="font-size:16px;font-weight:bold;color:#2d6a4f;">${avgCal}</div><div style="font-size:8px;color:#666;">平均熱量</div></div>
        <div style="background:#f0f9f4;padding:8px;border-radius:5px;text-align:center;border-left:2px solid #2d6a4f;"><div style="font-size:16px;font-weight:bold;color:#2d6a4f;">${avgPro}g</div><div style="font-size:8px;color:#666;">蛋白質</div></div>
        <div style="background:#f0f9f4;padding:8px;border-radius:5px;text-align:center;border-left:2px solid #2d6a4f;"><div style="font-size:16px;font-weight:bold;color:#2d6a4f;">${avgCarbs}g</div><div style="font-size:8px;color:#666;">碳水</div></div>
        <div style="background:#f0f9f4;padding:8px;border-radius:5px;text-align:center;border-left:2px solid #2d6a4f;"><div style="font-size:16px;font-weight:bold;color:#2d6a4f;">${avgFat}g</div><div style="font-size:8px;color:#666;">脂肪</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:8px;">
        <thead><tr style="background:#2d6a4f;color:white;"><th style="padding:5px;">日期</th><th style="padding:5px;text-align:right;">熱量</th><th style="padding:5px;text-align:right;">蛋白</th><th style="padding:5px;text-align:right;">碳水</th><th style="padding:5px;text-align:right;">脂肪</th></tr></thead>
        <tbody>${records.slice(0,18).map((r,i) => `<tr style="background:${i%2===0?'#f9f9f9':'white'};"><td style="padding:4px;">${safeDate(r.date)}</td><td style="padding:4px;text-align:right;">${safeNum(r.total_calories)}</td><td style="padding:4px;text-align:right;">${safeNum(r.total_protein)}</td><td style="padding:4px;text-align:right;">${safeNum(r.total_carbs)}</td><td style="padding:4px;text-align:right;">${safeNum(r.total_fat)}</td></tr>`).join('')}</tbody>
      </table>
      <div style="text-align:center;margin-top:12px;font-size:7px;color:#999;">由 CaloScanAi 自動生成</div>
    </div>
  `;
}

function createStyle3HTML(stats, records, endDateStr) {
  const { avgCal, avgPro, avgCarbs, avgFat } = stats;
  const maxCal = Math.max(...records.slice(0,7).map(r => safeNum(r.total_calories)),1);
  const hues = ['#f093fb','#f5576c','#667eea','#764ba2','#2d6a4f','#11998e','#38ef7d'];
  return `
    <div style="width:148mm;min-height:210mm;background:white;padding:12mm 10mm;font-family:'Noto Sans TC',Arial,sans-serif;">
      <div style="font-size:14px;text-align:center;color:#333;margin-bottom:4px;">📊 每週營養分析</div>
      <div style="font-size:9px;text-align:center;color:#999;margin-bottom:10px;">攝取趨勢視覺化</div>
      <div style="background:linear-gradient(135deg,rgba(102,126,234,0.1),rgba(118,75,162,0.1));border-radius:8px;padding:12px;margin-bottom:10px;display:flex;align-items:flex-end;justify-content:space-between;height:55px;">
        ${records.slice(0,7).map((r,i) => {const h=Math.round((safeNum(r.total_calories)/maxCal)*45);return `<div style="width:26px;background:linear-gradient(180deg,${hues[i]},${hues[i]}50);border-radius:2px 2px 0 0;height:${h}%;"></div>`;}).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;font-size:8px;color:#666;"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;">
        <div style="background:white;border-radius:6px;padding:8px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.06);"><div style="font-size:14px;font-weight:bold;color:#f5576c;">${avgCal}</div><div style="font-size:8px;color:#666;">平均熱量</div></div>
        <div style="background:white;border-radius:6px;padding:8px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.06);"><div style="font-size:14px;font-weight:bold;color:#f5576c;">${avgPro}g</div><div style="font-size:8px;color:#666;">蛋白質</div></div>
        <div style="background:white;border-radius:6px;padding:8px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.06);"><div style="font-size:14px;font-weight:bold;color:#f5576c;">${avgCarbs}g</div><div style="font-size:8px;color:#666;">碳水</div></div>
        <div style="background:white;border-radius:6px;padding:8px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.06);"><div style="font-size:14px;font-weight:bold;color:#f5576c;">${avgFat}g</div><div style="font-size:8px;color:#666;">脂肪</div></div>
      </div>
      <div style="text-align:center;font-size:7px;color:#999;margin-top:10px;">CaloScanAi</div>
    </div>
  `;
}

function createStyle4HTML(stats, records, endDateStr) {
  const { avgCal, avgPro, avgCarbs, avgFat } = stats;
  return `
    <div style="width:148mm;min-height:210mm;background:white;padding:12mm 10mm;font-family:'Noto Sans TC',Arial,sans-serif;">
      <div style="background:black;color:white;padding:15px;text-align:center;margin-bottom:12px;"><div style="font-size:20px;font-weight:bold;letter-spacing:1px;">HEALTH REPORT</div><div style="font-size:9px;margin-top:5px;">CALOSCANAI | ${records.length}-DAY SUMMARY</div></div>
      <div style="text-align:center;padding:18px 0;border-bottom:1px dashed #ccc;margin-bottom:12px;"><div style="font-size:36px;font-weight:bold;color:#000;">${avgCal}</div><div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:2px;margin-top:5px;">Daily Average Calories</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">
        <div style="background:#f5f5f5;padding:12px;text-align:center;"><div style="font-size:20px;font-weight:bold;color:#000;">${avgPro}g</div><div style="font-size:8px;color:#666;text-transform:uppercase;">Protein</div></div>
        <div style="background:#f5f5f5;padding:12px;text-align:center;"><div style="font-size:20px;font-weight:bold;color:#000;">${avgCarbs}g</div><div style="font-size:8px;color:#666;text-transform:uppercase;">Carbs</div></div>
        <div style="background:#f5f5f5;padding:12px;text-align:center;"><div style="font-size:20px;font-weight:bold;color:#000;">${avgFat}g</div><div style="font-size:8px;color:#666;text-transform:uppercase;">Fat</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:7px;">${records.slice(0,12).map((r,i) => `<tr style="background:${i%2===0?'#f9f9f9':'white'};"><td style="padding:4px;color:#666;">${safeDate(r.date)}</td><td style="padding:4px;font-weight:bold;">${safeNum(r.total_calories)} kcal</td><td style="padding:4px;">P:${safeNum(r.total_protein)}g</td><td style="padding:4px;">C:${safeNum(r.total_carbs)}g</td><td style="padding:4px;">F:${safeNum(r.total_fat)}g</td></tr>`).join('')}</table>
      <div style="text-align:center;margin-top:10px;font-size:7px;color:#999;">CALOSCANAI | ${endDateStr}</div>
    </div>
  `;
}

function createStyle5HTML(stats, records, endDateStr) {
  const { avgCal, avgPro, avgCarbs, avgFat } = stats;
  return `
    <div style="width:148mm;min-height:210mm;background:white;padding:12mm 10mm;font-family:'Noto Sans TC',Arial,sans-serif;">
      <div style="font-size:14px;color:#11998e;margin-bottom:2px;">Daily Summary</div>
      <div style="font-size:8px;color:#666;margin-bottom:10px;">Report Period: ${records.length>0?records[records.length-1].date:'N/A'} ~ ${endDateStr}</div>
      <div style="border-bottom:1px solid #11998e;margin-bottom:8px;"></div>
      ${[{label:'Average Calories',value:avgCal+' kcal'},{label:'Average Protein',value:avgPro+'g'},{label:'Average Carbs',value:avgCarbs+'g'},{label:'Average Fat',value:avgFat+'g'}].map(s => `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;"><span style="color:#666;font-size:9px;">${s.label}</span><span style="font-weight:bold;color:#11998e;font-size:9px;">${s.value}</span></div>`).join('')}
      <table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:7px;">
        <thead><tr style="background:#11998e;color:white;"><th style="padding:4px;text-align:left;">Date</th><th style="padding:4px;text-align:right;">Cal</th><th style="padding:4px;">P</th><th style="padding:4px;">C</th><th style="padding:4px;">F</th></tr></thead>
        <tbody>${records.slice(0,20).map((r,i) => `<tr style="background:${i%2===0?'#fafafa':'white'};"><td style="padding:4px;color:#11998e;font-weight:bold;">${safeDate(r.date)}</td><td style="padding:4px;text-align:right;">${safeNum(r.total_calories)}</td><td style="padding:4px;">${safeNum(r.total_protein)}</td><td style="padding:4px;">${safeNum(r.total_carbs)}</td><td style="padding:4px;">${safeNum(r.total_fat)}</td></tr>`).join('')}</tbody>
      </table>
      <div style="text-align:center;margin-top:8px;font-size:7px;color:#999;">Generated by CaloScanAi</div>
    </div>
  `;
}

function createStyle6HTML(stats, records, endDateStr) {
  const { avgCal, avgPro, avgCarbs, avgFat } = stats;
  const days = ['一','二','三','四','五','六','日'];
  return `
    <div style="width:148mm;min-height:210mm;background:white;padding:12mm 10mm;font-family:'Noto Sans TC',Arial,sans-serif;">
      <div style="font-size:22px;text-align:center;margin-bottom:6px;">📋</div>
      <div style="font-size:13px;text-align:center;color:#333;margin-bottom:12px;">30天健康報告</div>
      <div style="display:flex;justify-content:center;gap:5px;margin-bottom:12px;flex-wrap:wrap;">
        ${[{value:avgCal,label:'平均熱量'},{value:avgPro+'g',label:'蛋白質'},{value:avgCarbs+'g',label:'碳水'},{value:avgFat+'g',label:'脂肪'}].map(item => `<div style="background:linear-gradient(135deg,rgba(168,237,234,0.3),rgba(254,214,227,0.3));padding:6px 10px;border-radius:10px;text-align:center;"><div style="font-size:12px;font-weight:bold;color:#333;">${item.value}</div><div style="font-size:7px;color:#666;">${item.label}</div></div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:10px;">
        ${records.slice(0,14).map((r,i) => {const col=i%7;return `<div style="background:#f8f9fa;border-radius:5px;padding:5px;text-align:center;"><div style="font-size:6px;color:#999;">${days[col]}</div><div style="font-size:8px;font-weight:bold;color:#333;">${safeDate(r.date).slice(5)}</div><div style="font-size:7px;color:#666;margin-top:2px;">${safeNum(r.total_calories)}</div></div>`;}).join('')}
      </div>
      <div style="text-align:center;margin-top:10px;font-size:8px;color:#999;">✨ 由 CaloScanAi 為您生成 ✨</div>
    </div>
  `;
}

// ============================================================
// 主函式：產生 PDF
// ============================================================
window.generatePDF_Style = async function(style, records, endDateStr) {
  const stats = calcStats(records);

  // 建立 HTML 容器
  let html = '';
  switch(style) {
    case 1: html = createStyle1HTML(stats, records, endDateStr); break;
    case 2: html = createStyle2HTML(stats, records, endDateStr); break;
    case 3: html = createStyle3HTML(stats, records, endDateStr); break;
    case 4: html = createStyle4HTML(stats, records, endDateStr); break;
    case 5: html = createStyle5HTML(stats, records, endDateStr); break;
    case 6: html = createStyle6HTML(stats, records, endDateStr); break;
    default: html = createStyle2HTML(stats, records, endDateStr);
  }

  const container = document.createElement('div');
  container.id = 'pdf-render-container';
  container.innerHTML = html;
  container.style.cssText = 'position:fixed;left:-9999px;top:0;';

  document.body.appendChild(container);

  // 等待 html2canvas
  if (typeof html2canvas === 'undefined') {
    await window.loadHtml2Canvas();
  }

  // 等待 fonts loaded
  await document.fonts.ready;

  // 截圖
  const canvas = await html2canvas(container, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    width: 420
  });

  // 移除容器
  document.body.removeChild(container);

  // 建立 PDF (A5 格式)
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [148, 210]
  });

  const imgWidth = 148;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, Math.min(imgHeight, 210));

  doc.save(`caloscanai_report_style${style}_${endDateStr}.pdf`);
};