const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { logActivity } = require('../services/logger');
const { syncUnstopEvents } = require('../services/unstop');

// Setup file upload storage for local environment
const uploadDir = path.join(__dirname, '../../uploads/posters');
if (!fs.existsSync(uploadDir)) {
  try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) {}
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `poster_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Helper: Format Date to YYYY-MM-DD
function formatDate(d) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toISOString().split('T')[0];
}

// Helper: Map DB row to EventDto
function mapToDto(row, savedIds = new Set()) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = row.start_date ? new Date(row.start_date) : null;
  const end = row.end_date ? new Date(row.end_date) : null;
  const deadline = row.registration_deadline ? new Date(row.registration_deadline) : null;

  if (start) start.setHours(0, 0, 0, 0);
  if (end) end.setHours(0, 0, 0, 0);
  if (deadline) deadline.setHours(0, 0, 0, 0);

  let status = 'UPCOMING';
  let daysToDeadline = 0;

  if (deadline) {
    const diffTime = deadline.getTime() - today.getTime();
    daysToDeadline = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const isEndedByEndDate = end && today > end;
  const isRegClosed = deadline && today > deadline;
  const daysPastDeadline = deadline ? Math.floor((today.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  // Rule: Event is ENDED if actual end date passed OR registration deadline passed more than 3 days ago.
  // Stays as REG_CLOSED for up to 3 days after registration finished.
  if (isEndedByEndDate || (isRegClosed && daysPastDeadline > 3)) {
    status = 'ENDED';
  } else if (isRegClosed && daysPastDeadline <= 3) {
    status = 'REG_CLOSED';
  } else if (daysToDeadline <= 5 && daysToDeadline >= 0) {
    status = 'DEADLINE_SOON';
  } else {
    status = 'UPCOMING';
  }

  const eventId = parseInt(row.id, 10);

  return {
    id: eventId,
    title: row.title,
    description: row.description,
    eventType: row.event_type,
    teamSizeMin: row.team_size_min,
    teamSizeMax: row.team_size_max,
    startDate: formatDate(row.start_date),
    endDate: formatDate(row.end_date),
    registrationDeadline: formatDate(row.registration_deadline),
    posterPath: row.poster_path,
    registrationLink: row.registration_link,
    mode: row.mode,
    venue: row.venue,
    skills: row.skills,
    status,
    daysToDeadline,
    isSaved: savedIds.has(eventId),
    createdByRegNo: row.creator_reg_no || '',
    createdByName: row.creator_name || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
  };
}

async function getSavedEventIds(userId) {
  if (!userId) return new Set();
  const res = await db.query('SELECT event_id FROM saved_events WHERE user_id = $1', [userId]);
  return new Set(res.rows.map(r => parseInt(r.event_id, 10)));
}

const BASE_QUERY = `
  SELECT e.*, u.registration_number AS creator_reg_no, u.name AS creator_name
  FROM events e
  LEFT JOIN users u ON e.created_by = u.id
`;

// Filter active events: Not ended by end date AND registration not passed by more than 3 days
const ACTIVE_FILTER = `
  WHERE e.end_date >= CURRENT_DATE 
    AND (e.registration_deadline IS NULL OR e.registration_deadline >= CURRENT_DATE - INTERVAL '3 days')
`;

// Filter ended events: End date passed OR registration passed more than 3 days ago
const ENDED_FILTER = `
  WHERE e.end_date < CURRENT_DATE 
     OR (e.registration_deadline IS NOT NULL AND e.registration_deadline < CURRENT_DATE - INTERVAL '3 days')
`;

// Flag to prevent concurrent auto-syncs
let isSyncing = false;

async function checkAndAutoSyncEvents() {
  if (isSyncing) return;
  try {
    const countRes = await db.query(`SELECT COUNT(*) FROM events ${ACTIVE_FILTER}`);
    const activeCount = parseInt(countRes.rows[0].count, 10);
    if (activeCount < 5) {
      isSyncing = true;
      syncUnstopEvents().catch(console.error).finally(() => { isSyncing = false; });
    }
  } catch (e) {
    isSyncing = false;
  }
}

// GET /api/events & /api/events/all & /api/events/calendar (All active current & future events)
router.get(['/', '/all', '/calendar'], optionalAuth, async (req, res) => {
  try {
    const savedIds = await getSavedEventIds(req.user?.id);
    const result = await db.query(`${BASE_QUERY} ${ACTIVE_FILTER} ORDER BY e.start_date ASC, e.id DESC`);
    const dtos = result.rows.map(r => mapToDto(r, savedIds));

    // Trigger background sync if events count is low
    checkAndAutoSyncEvents();

    res.json(dtos);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/events/upcoming (Future events where registration is open)
router.get('/upcoming', optionalAuth, async (req, res) => {
  try {
    const savedIds = await getSavedEventIds(req.user?.id);
    const result = await db.query(
      `${BASE_QUERY} 
       WHERE e.end_date >= CURRENT_DATE 
         AND (e.registration_deadline IS NULL OR e.registration_deadline >= CURRENT_DATE)
       ORDER BY e.start_date ASC, e.id DESC`
    );
    const dtos = result.rows.map(r => mapToDto(r, savedIds));
    res.json(dtos);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/events/ended (Only events that ended or whose registration passed > 3 days ago)
router.get('/ended', optionalAuth, async (req, res) => {
  try {
    const savedIds = await getSavedEventIds(req.user?.id);
    const result = await db.query(
      `${BASE_QUERY} ${ENDED_FILTER} ORDER BY e.end_date DESC, e.id DESC`
    );
    const dtos = result.rows.map(r => mapToDto(r, savedIds));
    res.json(dtos);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/events/deadline-soon (Registration deadline closing within 7 days)
router.get('/deadline-soon', optionalAuth, async (req, res) => {
  try {
    const savedIds = await getSavedEventIds(req.user?.id);
    const result = await db.query(
      `${BASE_QUERY} 
       WHERE e.registration_deadline >= CURRENT_DATE 
         AND e.registration_deadline <= CURRENT_DATE + INTERVAL '7 days'
         AND e.end_date >= CURRENT_DATE
       ORDER BY e.registration_deadline ASC, e.id DESC`
    );
    const dtos = result.rows.map(r => mapToDto(r, savedIds));
    res.json(dtos);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/events/latest (Latest active events uploaded)
router.get('/latest', optionalAuth, async (req, res) => {
  try {
    const savedIds = await getSavedEventIds(req.user?.id);
    const result = await db.query(
      `${BASE_QUERY} ${ACTIVE_FILTER} ORDER BY e.created_at DESC, e.id DESC LIMIT 10`
    );
    const dtos = result.rows.map(r => mapToDto(r, savedIds));
    res.json(dtos);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/events/search
router.get('/search', optionalAuth, async (req, res) => {
  try {
    const { query = '', eventType = 'ALL', mode = 'ALL', view = 'all' } = req.query;
    const savedIds = await getSavedEventIds(req.user?.id);

    let baseFilter = ACTIVE_FILTER;
    if (view === 'upcoming') {
      baseFilter = "WHERE e.end_date >= CURRENT_DATE AND (e.registration_deadline IS NULL OR e.registration_deadline >= CURRENT_DATE)";
    } else if (view === 'ended') {
      baseFilter = ENDED_FILTER;
    } else if (view === 'deadline-soon') {
      baseFilter = "WHERE e.registration_deadline >= CURRENT_DATE AND e.registration_deadline <= CURRENT_DATE + INTERVAL '7 days' AND e.end_date >= CURRENT_DATE";
    }

    const result = await db.query(`${BASE_QUERY} ${baseFilter} ORDER BY e.start_date ASC, e.id DESC`);
    let dtos = result.rows.map(r => mapToDto(r, savedIds));

    const q = query.trim().toLowerCase();
    const type = eventType.trim().toUpperCase();
    const m = mode.trim().toUpperCase();

    dtos = dtos.filter(dto => {
      if (type !== 'ALL' && dto.eventType?.toUpperCase() !== type) return false;
      if (m !== 'ALL' && dto.mode?.toUpperCase() !== m) return false;
      if (q) {
        const title = (dto.title || '').toLowerCase();
        const desc = (dto.description || '').toLowerCase();
        const skills = (dto.skills || '').toLowerCase();
        const venue = (dto.venue || '').toLowerCase();
        const eType = (dto.eventType || '').toLowerCase();
        const eMode = (dto.mode || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || skills.includes(q) || venue.includes(q) || eType.includes(q) || eMode.includes(q);
      }
      return true;
    });

    res.json(dtos);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/events/:id
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    if (isNaN(eventId)) return res.status(400).json({ success: false, message: 'Invalid event ID' });

    const savedIds = await getSavedEventIds(req.user?.id);
    const result = await db.query(`${BASE_QUERY} WHERE e.id = $1`, [eventId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    res.json(mapToDto(result.rows[0], savedIds));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/events (create event)
router.post('/', requireAuth, upload.single('poster'), async (req, res) => {
  try {
    let dto = {};
    if (req.body.event) {
      dto = typeof req.body.event === 'string' ? JSON.parse(req.body.event) : req.body.event;
    } else {
      dto = req.body;
    }

    if (!dto.title || !dto.description || !dto.startDate || !dto.endDate || !dto.registrationDeadline) {
      return res.status(400).json({ success: false, message: 'Missing required event fields.' });
    }

    let posterPath = dto.posterPath || null;
    if (req.file) {
      posterPath = `/uploads/posters/${req.file.filename}`;
    }

    const insertQuery = `
      INSERT INTO events (
        title, description, event_type, team_size_min, team_size_max,
        start_date, end_date, registration_deadline, poster_path,
        registration_link, mode, venue, skills, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      dto.title,
      dto.description,
      dto.eventType || 'HACKATHON',
      dto.teamSizeMin || 1,
      dto.teamSizeMax || 4,
      dto.startDate,
      dto.endDate,
      dto.registrationDeadline,
      posterPath,
      dto.registrationLink || '',
      dto.mode || 'ONLINE',
      dto.venue || '',
      dto.skills || '',
      req.user.id
    ];

    const result = await db.query(insertQuery, values);
    const createdEvent = result.rows[0];

    await logActivity(
      req.user.registrationNumber,
      req.user.name,
      req.user.role,
      'CREATE_EVENT',
      `Published event: "${createdEvent.title}" (ID: ${createdEvent.id})`,
      req
    );

    res.json(mapToDto(createdEvent));
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ success: false, message: 'Failed to publish event: ' + err.message });
  }
});

// POST /api/events/:id/save (toggle save)
router.post('/:id/save', requireAuth, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    await db.query(
      `INSERT INTO saved_events (user_id, event_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, event_id) DO NOTHING`,
      [req.user.id, eventId]
    );
    res.json({ success: true, message: 'Event saved to your bookmarks!' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/events/:id/save (unsave)
router.delete('/:id/save', requireAuth, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    await db.query('DELETE FROM saved_events WHERE user_id = $1 AND event_id = $2', [req.user.id, eventId]);
    res.json({ success: true, message: 'Event removed from bookmarks.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/events/:id/report
router.post('/:id/report', requireAuth, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    const { reason, description } = req.body || {};
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason is required to report an event.' });
    }

    await db.query(
      `INSERT INTO reports (event_id, reported_by, reason, description, status, created_at)
       VALUES ($1, $2, $3, $4, 'PENDING', NOW())`,
      [eventId, req.user.id, reason, description || '']
    );

    await logActivity(
      req.user.registrationNumber,
      req.user.name,
      req.user.role,
      'REPORT_EVENT',
      `Reported event ID ${eventId}: "${reason}"`,
      req
    );

    res.json({ success: true, message: 'Report submitted for admin review. Thank you!' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/events/sync-unstop (Sync live hackathons from Unstop)
router.post('/sync-unstop', async (req, res) => {
  try {
    const count = await syncUnstopEvents();
    res.json({ success: true, message: `Successfully synced ${count} live hackathons from Unstop!` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Unstop sync failed: ' + err.message });
  }
});

// DELETE /api/events/clear-unstop
router.delete('/clear-unstop', async (req, res) => {
  try {
    const result = await db.query("DELETE FROM events WHERE venue LIKE '%(Unstop)%' OR skills LIKE '%Unstop%'");
    res.json({ success: true, message: `Cleared ${result.rowCount} Unstop events from database.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to clear Unstop events: ' + err.message });
  }
});

module.exports = router;
