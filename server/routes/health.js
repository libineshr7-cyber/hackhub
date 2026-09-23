const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/health', async (req, res) => {
  let dbStatus = 'UNKNOWN';
  try {
    const start = Date.now();
    await db.query('SELECT 1');
    dbStatus = `CONNECTED (${Date.now() - start}ms)`;
  } catch (err) {
    dbStatus = `DISCONNECTED: ${err.message}`;
  }

  res.json({
    status: 'UP',
    app: 'HackHub',
    db: dbStatus,
    timestamp: new Date().toISOString(),
    message: 'HackHub server is healthy & awake!'
  });
});

module.exports = router;
