const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// GET /api/notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT n.*, u.name AS sender_name, u.registration_number AS sender_reg_no
      FROM notifications n
      LEFT JOIN users u ON n.sender_id = u.id
      WHERE n.recipient_id = $1
      ORDER BY n.created_at DESC
    `;
    const result = await db.query(query, [req.user.id]);

    const dtos = result.rows.map(r => ({
      id: parseInt(r.id, 10),
      title: r.title,
      message: r.message,
      type: r.type,
      link: r.link,
      read: r.is_read,
      createdAt: r.created_at,
      senderName: r.sender_name || 'System',
      senderRegistrationNumber: r.sender_reg_no || ''
    }));

    res.json(dtos);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', optionalAuth, async (req, res) => {
  try {
    if (!req.user) return res.json({ count: 0 });
    const result = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND is_read = false',
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    res.json({ count: 0 });
  }
});

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET is_read = true WHERE recipient_id = $1', [req.user.id]);
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/notifications/clear
router.delete('/clear', requireAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM notifications WHERE recipient_id = $1', [req.user.id]);
    res.json({ success: true, message: 'All notifications cleared.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const notifId = parseInt(req.params.id, 10);
    await db.query('DELETE FROM notifications WHERE id = $1 AND recipient_id = $2', [notifId, req.user.id]);
    res.json({ success: true, message: 'Notification deleted.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
