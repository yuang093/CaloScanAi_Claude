// 日期工具函式 - 處理本地時區

/**
 * 取得 UTC+8 (台北時間) 的今天日期 (YYYY-MM-DD)
 * 使用 getFullYear/getMonth/getDate 而非 getUTC*，確保取的台北時區的日期分量
 * 在凌晨 00:00-08:00 (台灣時間) 區間，與後端嚴格一致
 */
export function getLocalDate() {
  const now = new Date();
  // 手動偏移 UTC+8：取得 UTC 時間後加 8 小時
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const taiwanDate = new Date(utc + (8 * 60 * 60 * 1000));
  // 從 taiwanDate 取得 UTC+8 時區的日期分量（使用 getFullYear/getMonth/getDate）
  const year = taiwanDate.getFullYear();
  const month = String(taiwanDate.getMonth() + 1).padStart(2, '0');
  const day = String(taiwanDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 將 Date 物件轉換為 UTC+8 (台北時間) 日期字串 (YYYY-MM-DD)
 */
export function dateToLocalString(date) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const taiwanDate = new Date(utc + (8 * 60 * 60 * 1000));
  const year = taiwanDate.getFullYear();
  const month = String(taiwanDate.getMonth() + 1).padStart(2, '0');
  const day = String(taiwanDate.getDate()).padStart(2, '0');
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