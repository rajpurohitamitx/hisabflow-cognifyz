const mongoose = require('mongoose');
const { app } = require('../server');

let connectionPromise;

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured.');
  }
  if (mongoose.connection.readyState === 1) return;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI).catch((error) => {
      connectionPromise = null;
      throw error;
    });
  }
  await connectionPromise;
}

module.exports = async (req, res) => {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(500).json({ error: 'JWT_SECRET is not configured correctly.' });
    }
    await connectDatabase();
    return app(req, res);
  } catch (error) {
    console.error('[vercel]', error.message);
    return res.status(500).json({ error: 'Database connection failed. Check MONGODB_URI in Vercel environment variables.' });
  }
};
