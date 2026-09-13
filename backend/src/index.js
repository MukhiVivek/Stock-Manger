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
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    message: 'Internal server error',
    error: err.message
  });
});

const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/stock-manager';

// Connect to MongoDB
let cachedConnection = null;

async function connectDB() {
  if (cachedConnection) {
    return cachedConnection;
  }

  cachedConnection = mongoose
    .connect(MONGO_URI)
    .then(async () => {
      console.log('✓ Connected to MongoDB');

      await seedDatabase();

      return mongoose.connection;
    })
    .catch(err => {
      console.error('✗ MongoDB connection error:', err.message);

      cachedConnection = null;

      throw err;
    });

  return cachedConnection;
}

// Connect database before handling requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// IMPORTANT: Export app for Vercel
module.exports = app;