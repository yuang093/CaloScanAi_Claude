// 日期工具函式 - 處理本地時區

/**
 * 取得 UTC+8 (台北時間) 的今天日期 (YYYY-MM-DD)
 * 統一使用台北時區，避免 Server (日本 UTC+9) 與 Client (台北 UTC+8) 時差問題
 *
 * 注意：必須使用 getUTCFullYear/getUTCMonth/getUTCDate 取得 Taiwan 時區的日期分量
 * 不能使用 toISOString()，因為它會返回 UTC 時區的日期，在早上 01:00-08:00 會差一天
 */
export function getLocalDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);  // 轉換為 UTC 時間
  const taiwanDate = new Date(utc + (8 * 60 * 60 * 1000));  // UTC+8 = 台北時間
  // 直接從 taiwanDate 取得 UTC+8 時區的日期分量，避免 toISOString() 的 UTC 轉換問題
  const year = taiwanDate.getUTCFullYear();
  const month = String(taiwanDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(taiwanDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 將 Date 物件轉換為 UTC+8 (台北時間) 日期字串 (YYYY-MM-DD)
 */
export function dateToLocalString(date) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const taiwanDate = new Date(utc + (8 * 60 * 60 * 1000));
  // 直接從 taiwanDate 取得 UTC+8 時區的日期分量
  const year = taiwanDate.getUTCFullYear();
  const month = String(taiwanDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(taiwanDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 取得 UTC+8 (台北時間) 的 N 天前的日期 (YYYY-MM-DD)
 */
export function getLocalDateDaysAgo(days) {
  const today = new Date();
  today.setDate(today.getDate() - days);
  return dateToLocalString(today);
}