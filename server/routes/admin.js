const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logActivity } = require('../services/logger');

// Require admin or subadmin for all admin routes
router.use(requireAuth);
router.use(requireRole('ROLE_ADMIN', 'ROLE_SUBADMIN'));

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [students, subadmins, events, teams, reports, active, upcoming] = await Promise.all([
      db.query("SELECT COUNT(*) FROM users WHERE role = 'ROLE_STUDENT'"),
      db.query("SELECT COUNT(*) FROM users WHERE role = 'ROLE_SUBADMIN'"),
      db.query("SELECT COUNT(*) FROM events"),
      db.query("SELECT COUNT(*) FROM teams"),
      db.query("SELECT COUNT(*) FROM reports WHERE status = 'PENDING'"),
      db.query("SELECT COUNT(*) FROM users WHERE role = 'ROLE_STUDENT' AND status = 'ACTIVE'"),
      db.query("SELECT COUNT(*) FROM events WHERE end_date >= CURRENT_DATE")
    ]);

    res.json({
      totalStudents: parseInt(students.rows[0].count, 10),
      totalSubAdmins: parseInt(subadmins.rows[0].count, 10),
      totalEvents: parseInt(events.rows[0].count, 10),
      totalTeams: parseInt(teams.rows[0].count, 10),
      pendingReports: parseInt(reports.rows[0].count, 10),
      activeStudents: parseInt(active.rows[0].count, 10),
      upcomingEvents: parseInt(upcoming.rows[0].count, 10)
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper for UserResponse
function mapUserResponse(u) {
  return {
    id: parseInt(u.id, 10),
    registrationNumber: u.registration_number,
    name: u.name,
    email: u.email,
    role: u.role,
    skills: u.skills || '',
    department: u.department || '',
    assignedYear: u.assigned_year || '',
    studentLimit: u.student_limit,
    status: u.status,
    firstLogin: u.first_login,
    createdAt: u.created_at
  };
}

// GET /api/admin/students
router.get('/students', async (req, res) => {
  try {
    const { search = '' } = req.query;
    const q = search.trim().toLowerCase();

    let sql = `SELECT * FROM users WHERE role = 'ROLE_STUDENT'`;
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (LOWER(registration_number) LIKE $${params.length} OR LOWER(name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`;
    }

    sql += ' ORDER BY registration_number ASC';
    const result = await db.query(sql, params);
    res.json(result.rows.map(mapUserResponse));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/students/create
router.post('/students/create', async (req, res) => {
  try {
    const { registrationNumber, name, email, department, assignedYear, skills } = req.body || {};
    if (!registrationNumber || !name) {
      return res.status(400).json({ success: false, message: 'Registration number and name required.' });
    }

    const regNo = registrationNumber.trim().toUpperCase();
    const existing = await db.query('SELECT id FROM users WHERE UPPER(registration_number) = $1', [regNo]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Student with this registration number already exists.' });
    }

    const defaultHash = await bcrypt.hash('123', 10);
    const insertRes = await db.query(
      `INSERT INTO users (registration_number, name, email, password_hash, role, skills, department, assigned_year, status, first_login, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'ROLE_STUDENT', $5, $6, $7, 'ACTIVE', true, NOW(), NOW())
       RETURNING *`,
      [regNo, name.trim(), (email || `${regNo.toLowerCase()}@college.edu`).trim(), defaultHash, skills || '', department || '', assignedYear || '']
    );

    await logActivity(req.user.registrationNumber, req.user.name, req.user.role, 'CREATE_STUDENT', `Created student ${regNo} (${name})`, req);
    res.json(mapUserResponse(insertRes.rows[0]));
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/students/:id/status
router.put('/students/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body || {};
    await db.query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
    await logActivity(req.user.registrationNumber, req.user.name, req.user.role, 'UPDATE_STUDENT_STATUS', `Updated student ID ${id} status to ${status}`, req);
    res.json({ success: true, message: `Student status updated to ${status}.` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/admin/students/:id/reset-password
router.post('/students/:id/reset-password', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const defaultHash = await bcrypt.hash('123', 10);
    await db.query('UPDATE users SET password_hash = $1, first_login = true, updated_at = NOW() WHERE id = $2', [defaultHash, id]);
    await logActivity(req.user.registrationNumber, req.user.name, req.user.role, 'RESET_PASSWORD', `Reset student ID ${id} password to default`, req);
    res.json({ success: true, message: 'Password reset to default "123". Student must change it on login.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/students/:id
router.delete('/students/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    await logActivity(req.user.registrationNumber, req.user.name, req.user.role, 'DELETE_STUDENT', `Deleted student ID ${id}`, req);
    res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Sub-Admin Management (ROLE_ADMIN only)
router.get('/subadmins', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE role = 'ROLE_SUBADMIN' ORDER BY name ASC");
    res.json(result.rows.map(mapUserResponse));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/subadmins/create', async (req, res) => {
  try {
    const { registrationNumber, name, email, department, assignedYear, studentLimit = 50 } = req.body || {};
    const regNo = registrationNumber.trim().toUpperCase();
    const defaultHash = await bcrypt.hash('123', 10);

    const insertRes = await db.query(
      `INSERT INTO users (registration_number, name, email, password_hash, role, department, assigned_year, student_limit, status, first_login, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'ROLE_SUBADMIN', $5, $6, $7, 'ACTIVE', true, NOW(), NOW())
       RETURNING *`,
      [regNo, name.trim(), email.trim(), defaultHash, department || '', assignedYear || '', studentLimit]
    );

    await logActivity(req.user.registrationNumber, req.user.name, req.user.role, 'CREATE_SUBADMIN', `Created sub-admin ${regNo}`, req);
    res.json(mapUserResponse(insertRes.rows[0]));
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/subadmins/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, email, department, assignedYear, studentLimit } = req.body || {};
    await db.query(
      `UPDATE users 
       SET name = $1, email = $2, department = $3, assigned_year = $4, student_limit = $5, updated_at = NOW() 
       WHERE id = $6`,
      [name, email, department, assignedYear, studentLimit, id]
    );
    res.json({ success: true, message: 'Sub-admin details updated.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/subadmins/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body || {};
    await db.query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
    res.json({ success: true, message: `Sub-admin status updated to ${status}.` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/subadmins/:id/reset-password', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const defaultHash = await bcrypt.hash('123', 10);
    await db.query('UPDATE users SET password_hash = $1, first_login = true, updated_at = NOW() WHERE id = $2', [defaultHash, id]);
    res.json({ success: true, message: 'Sub-admin password reset to default "123".' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/subadmins/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'Sub-admin deleted successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Activity logs
router.get('/activity-logs', async (req, res) => {
  try {
    const { search = '', action = '' } = req.query;
    let sql = 'SELECT * FROM activity_logs WHERE 1=1';
    const params = [];

    if (search) {
      params.push(`%${search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(user_reg_no) LIKE $${params.length} OR LOWER(user_name) LIKE $${params.length} OR LOWER(details) LIKE $${params.length})`;
    }

    if (action && action !== 'ALL') {
      params.push(action);
      sql += ` AND action = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC LIMIT 100';
    const result = await db.query(sql, params);
    res.json(result.rows.map(r => ({
      id: parseInt(r.id, 10),
      userRegNo: r.user_reg_no,
      userName: r.user_name,
      userRole: r.user_role,
      action: r.action,
      details: r.details,
      ipAddress: r.ip_address,
      createdAt: r.created_at
    })));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/activity-logs', async (req, res) => {
  try {
    await db.query('DELETE FROM activity_logs');
    res.json({ success: true, message: 'All activity logs cleared.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Reports
router.get('/reports', async (req, res) => {
  try {
    const query = `
      SELECT r.*, e.title AS event_title, u.registration_number AS reporter_reg_no, u.name AS reporter_name
      FROM reports r
      JOIN events e ON r.event_id = e.id
      JOIN users u ON r.reported_by = u.id
      ORDER BY r.created_at DESC
    `;
    const result = await db.query(query);
    res.json(result.rows.map(r => ({
      id: parseInt(r.id, 10),
      eventId: parseInt(r.event_id, 10),
      eventTitle: r.event_title,
      reportedByRegNo: r.reporter_reg_no,
      reportedByName: r.reporter_name,
      reason: r.reason,
      description: r.description,
      status: r.status,
      createdAt: r.created_at
    })));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/reports/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body || {};
    await db.query('UPDATE reports SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true, message: `Report status updated to ${status}.` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Admin Events management
router.get('/events', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.*, u.registration_number AS creator_reg_no, u.name AS creator_name
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      ORDER BY e.start_date ASC
    `);

    const dtos = result.rows.map(row => ({
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
      createdByRegNo: row.creator_reg_no || '',
      createdByName: row.creator_name || '',
      createdAt: row.created_at
    }));

    res.json(dtos);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/events/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, description, eventType, teamSizeMin, teamSizeMax, startDate, endDate, registrationDeadline, mode, venue, skills, registrationLink } = req.body || {};
    await db.query(
      `UPDATE events
       SET title = $1, description = $2, event_type = $3, team_size_min = $4, team_size_max = $5,
           start_date = $6, end_date = $7, registration_deadline = $8, mode = $9, venue = $10,
           skills = $11, registration_link = $12, updated_at = NOW()
       WHERE id = $13`,
      [title, description, eventType, teamSizeMin, teamSizeMax, startDate, endDate, registrationDeadline, mode, venue, skills, registrationLink, id]
    );
    res.json({ success: true, message: 'Event updated successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/events/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM events WHERE id = $1', [id]);
    await logActivity(req.user.registrationNumber, req.user.name, req.user.role, 'DELETE_EVENT', `Deleted event ID ${id}`, req);
    res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Admin Teams management
router.get('/teams', async (req, res) => {
  try {
    const query = `
      SELECT t.*, e.title AS event_title, u.registration_number AS creator_reg_no, u.name AS creator_name
      FROM teams t
      JOIN events e ON t.event_id = e.id
      JOIN users u ON t.created_by = u.id
      ORDER BY t.created_at DESC
    `;
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/teams/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.query('DELETE FROM teams WHERE id = $1', [id]);
    await logActivity(req.user.registrationNumber, req.user.name, req.user.role, 'DELETE_TEAM_ADMIN', `Admin deleted team ID ${id}`, req);
    res.json({ success: true, message: 'Team deleted successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/admin/users/log
router.get('/users/log', async (req, res) => {
  try {
    const { search = '' } = req.query;
    const q = search.trim().toLowerCase();

    let sql = 'SELECT * FROM users';
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      sql += ` WHERE (LOWER(registration_number) LIKE $${params.length} OR LOWER(name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`;
    }

    sql += ' ORDER BY id ASC';
    const result = await db.query(sql, params);
    res.json(result.rows.map(mapUserResponse));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
