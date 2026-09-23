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
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const eventsRoutes = require('./routes/events');
const savedEventsRoutes = require('./routes/saved-events');
const teamsRoutes = require('./routes/teams');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

// Mount routes on /api
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api', savedEventsRoutes); // Handles /api/saved-events
app.use('/api/teams', teamsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);

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
