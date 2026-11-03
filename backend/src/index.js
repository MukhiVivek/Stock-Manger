require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const seedDatabase = require('./seed');

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/stock-manager';

// Connect to MongoDB
let isSeeded = false;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log('✓ Connected to MongoDB');

  if (!isSeeded) {
    isSeeded = true;
    try {
      await seedDatabase();
    } catch (err) {
      console.error('Seed error:', err.message);
    }
  }

  return mongoose.connection;
}

// Connect database BEFORE handling routes
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    res.status(500).json({
      message: 'Database connection failed',
      error: error.message,
    });
  }
});

// Routes
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/products', require('./routes/products'));
app.use('/api/warehouses', require('./routes/warehouses'));
app.use('/api/stock', require('./routes/stock'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    message: 'Internal server error',
    error: err.message,
  });
});

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on port ${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to connect DB & start server:', err);
  });
}

// IMPORTANT: Export app for Vercel
module.exports = app;