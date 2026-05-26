// 日期工具函式 - 處理本地時區

/**
 * 取得 UTC+8 (台北時間) 的今天日期 (YYYY-MM-DD)
 * 統一使用台北時區，避免 Server (日本 UTC+9) 與 Client (台北 UTC+8) 時差問題
 */
export function getLocalDate() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);  // 轉換為 UTC 時間
  const taiwanDate = new Date(utc + (8 * 60 * 60 * 1000));  // UTC+8 = 台北時間
  return taiwanDate.toISOString().split('T')[0];
}

/**
 * 將 Date 物件轉換為 UTC+8 (台北時間) 日期字串 (YYYY-MM-DD)
 */
export function dateToLocalString(date) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const taiwanDate = new Date(utc + (8 * 60 * 60 * 1000));
  return taiwanDate.toISOString().split('T')[0];
}

/**
 * 取得 UTC+8 (台北時間) 的 N 天前的日期 (YYYY-MM-DD)
 */
export function getLocalDateDaysAgo(days) {
  const today = new Date();
  today.setDate(today.getDate() - days);
  return dateToLocalString(today);
}