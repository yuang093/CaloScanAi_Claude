import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import foodRouter from '../routes/food.js';
import authRouter from '../routes/auth.js';
import progressRouter from '../routes/progress.js';
import barcodeRouter from '../routes/barcode.js';
import adminRouter from '../routes/admin.js';
import { errorHandler } from '../middleware/errorHandler.js';

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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(join(__dirname, '../..')));
app.use('/uploads', express.static(join(__dirname, '../../uploads')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/food', foodRouter);
app.use('/api/progress', progressRouter);
app.use('/api/barcode', barcodeRouter);
app.use('/api/admin', adminRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 CaloScanAi API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;