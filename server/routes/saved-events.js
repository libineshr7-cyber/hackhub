const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/saved-events
router.get('/saved-events', requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT e.*, u.registration_number AS creator_reg_no, u.name AS creator_name
      FROM saved_events se
      JOIN events e ON se.event_id = e.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE se.user_id = $1
      ORDER BY se.created_at DESC
    `;
    const result = await db.query(query, [req.user.id]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dtos = result.rows.map(row => {
      const end = row.end_date ? new Date(row.end_date) : null;
      const deadline = row.registration_deadline ? new Date(row.registration_deadline) : null;
      if (end) end.setHours(0, 0, 0, 0);
      if (deadline) deadline.setHours(0, 0, 0, 0);

      let status = 'UPCOMING';
      let daysToDeadline = 0;
      if (deadline) {
        daysToDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      if (end && today > end) status = 'ENDED';
      else if (deadline && today > deadline) status = 'REG_CLOSED';
      else if (daysToDeadline <= 5 && daysToDeadline >= 0) status = 'DEADLINE_SOON';

      return {
        id: parseInt(row.id, 10),
        title: row.title,
        description: row.description,
        eventType: row.event_type,
        teamSizeMin: row.team_size_min,
        teamSizeMax: row.team_size_max,
        startDate: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : null,
        endDate: row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : null,
        registrationDeadline: row.registration_deadline ? new Date(row.registration_deadline).toISOString().split('T')[0] : null,
        posterPath: row.poster_path,
        registrationLink: row.registration_link,
        mode: row.mode,
        venue: row.venue,
        skills: row.skills,
        status,
        daysToDeadline,
        isSaved: true,
        createdByRegNo: row.creator_reg_no || '',
        createdByName: row.creator_name || '',
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
      };
    });

    res.json(dtos);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
