export function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err.message);
  console.error('Stack:', err.stack);

  // Return error message as a string for consistent frontend handling
  res.status(err.status || 500).json({
    success: false,
    error: err.message || '伺服器錯誤'
  });
}