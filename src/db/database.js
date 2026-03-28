const mongoose = require('mongoose');
const config   = require('../../config');
const logger   = require('../utils/logger');

async function connectDB() {
  try {
    mongoose.connection.on('connected',    () => logger.info('✅ MongoDB connected'));
    mongoose.connection.on('disconnected', () => logger.warn('⚠️  MongoDB disconnected'));
    mongoose.connection.on('error',   err => logger.error(`❌ MongoDB error: ${err.message}`));

    await mongoose.connect(config.db.uri, config.db.options);
  } catch (err) {
    logger.error(`❌ MongoDB connection failed: ${err.message}`);
    throw err;
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected cleanly');
}

module.exports = { connectDB, disconnectDB };