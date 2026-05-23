import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import foodRouter from '../routes/food.js';
import authRouter from '../routes/auth.js';
import progressRouter from '../routes/progress.js';
import barcodeRouter from '../routes/barcode.js';
import adminRouter from '../routes/admin.js';
import profileRouter from '../routes/profile.js';
import { errorHandler } from '../middleware/errorHandler.js';
import db from '../services/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - supports comma-separated multiple origins
const corsOrigins = process.env.APP_URL
  ? process.env.APP_URL.split(',').map(url => url.trim())
  : [];

if (!process.env.APP_URL && process.env.NODE_ENV === 'production') {
  console.warn('⚠️ APP_URL not set, CORS is open to all origins');
}

app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : '*',
  credentials: true
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static files
app.use(express.static(join(__dirname, '../..')));
app.use('/uploads', express.static(join(__dirname, '../../uploads')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/food', foodRouter);
app.use('/api/progress', progressRouter);
app.use('/api/barcode', barcodeRouter);
app.use('/api/admin', adminRouter);
app.use('/api/profile', profileRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 CaloScanAi API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

// Graceful Shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    console.log('✅ HTTP server closed');

    // Close database connection
    try {
      db.close();
      console.log('✅ Database connection closed');
    } catch (err) {
      console.error('❌ Error closing database:', err.message);
    }

    console.log('👋 Shutdown complete');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;