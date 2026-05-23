// 日期工具函式 - 處理本地時區

/**
 * 取得本地時區的今天日期 (YYYY-MM-DD)
 */
export function getLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const localDate = new Date(now.getTime() - offset);
  return localDate.toISOString().split('T')[0];
}

/**
 * 將 Date 物件轉換為本地時區日期字串 (YYYY-MM-DD)
 */
export function dateToLocalString(date) {
  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().split('T')[0];
}

/**
 * 取得本地時區的 N 天前的日期 (YYYY-MM-DD)
 */
export function getLocalDateDaysAgo(days) {
  const today = new Date();
  today.setDate(today.getDate() - days);
  return dateToLocalString(today);
}