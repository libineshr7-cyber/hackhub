const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Global middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory (for posters)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Route Handlers
const healthRoutes = require('../server/routes/health');
const authRoutes = require('../server/routes/auth');
const userRoutes = require('../server/routes/user');
const eventsRoutes = require('../server/routes/events');
const savedEventsRoutes = require('../server/routes/saved-events');
const teamsRoutes = require('../server/routes/teams');
const notificationsRoutes = require('../server/routes/notifications');
const adminRoutes = require('../server/routes/admin');

// Mount routes for both /api and root paths (guarantees compatibility with Vercel rewrites)
const mount = (prefix) => {
  app.use(`${prefix}`, healthRoutes);
  app.use(`${prefix}/auth`, authRoutes);
  app.use(`${prefix}/user`, userRoutes);
  app.use(`${prefix}/events`, eventsRoutes);
  app.use(`${prefix}`, savedEventsRoutes);
  app.use(`${prefix}/teams`, teamsRoutes);
  app.use(`${prefix}/notifications`, notificationsRoutes);
  app.use(`${prefix}/admin`, adminRoutes);
};

mount('/api');
mount('');

// Fallback 404 for unmatched /api routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `Endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error occurred.'
  });
});

module.exports = app;
