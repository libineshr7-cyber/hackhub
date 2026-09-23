const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { logActivity } = require('../services/logger');

// Parse comma separated skills into a Set of lower-case strings
function parseSkills(skillsStr) {
  if (!skillsStr || typeof skillsStr !== 'string') return new Set();
  return new Set(
    skillsStr.split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Calculate skill match score (0 - 100)
function calculateSkillMatch(userSkillsStr, eventSkillsStr) {
  if (!userSkillsStr || !userSkillsStr.trim()) return 50;
  const userSkills = parseSkills(userSkillsStr);
  if (userSkills.size === 0) return 50;

  const targetSkills = parseSkills(eventSkillsStr);
  if (targetSkills.size === 0) return 75;

  let matchCount = 0;
  for (const s of userSkills) {
    if (targetSkills.has(s)) matchCount++;
  }

  if (matchCount === 0) return 30;
  const score = Math.round((matchCount / targetSkills.size) * 100);
  return Math.max(40, Math.min(100, score));
}

// Helper to fetch full team details with members
async function getFullTeamResponses(whereClause = '', params = [], currentUser = null) {
  const query = `
    SELECT 
      t.id, t.team_name, t.event_id, t.created_by, t.max_members, t.created_at,
      e.title AS event_title, e.skills AS event_skills,
      u.registration_number AS creator_reg_no, u.name AS creator_name
    FROM teams t
    JOIN events e ON t.event_id = e.id
    JOIN users u ON t.created_by = u.id
    ${whereClause}
    ORDER BY t.created_at DESC
  `;

  const teamsResult = await db.query(query, params);
  if (teamsResult.rows.length === 0) return [];

  const teamIds = teamsResult.rows.map(r => r.id);

  // Fetch active members for all these teams
  const membersResult = await db.query(
    `SELECT tm.id, tm.team_id, tm.user_id, tm.status, tm.joined_at,
            u.registration_number, u.name, u.email, u.skills, u.role
     FROM team_members tm
     JOIN users u ON tm.user_id = u.id
     WHERE tm.team_id = ANY($1) AND tm.status = 'ACTIVE'
     ORDER BY tm.joined_at ASC`,
    [teamIds]
  );

  const membersByTeam = new Map();
  for (const m of membersResult.rows) {
    const tid = parseInt(m.team_id, 10);
    if (!membersByTeam.has(tid)) membersByTeam.set(tid, []);
    membersByTeam.get(tid).push({
      id: parseInt(m.id, 10),
      userId: parseInt(m.user_id, 10),
      registrationNumber: m.registration_number,
      name: m.name,
      email: m.email,
      skills: m.skills || '',
      role: m.role,
      status: m.status
    });
  }

  // Fetch pending requests for current user if logged in
  let userRequestedTeamIds = new Set();
  if (currentUser) {
    const reqRes = await db.query(
      `SELECT team_id FROM team_requests 
       WHERE requester_id = $1 AND status = 'PENDING'`,
      [currentUser.id]
    );
    userRequestedTeamIds = new Set(reqRes.rows.map(r => parseInt(r.team_id, 10)));
  }

  return teamsResult.rows.map(t => {
    const tid = parseInt(t.id, 10);
    const members = membersByTeam.get(tid) || [];
    const isUserMember = currentUser ? members.some(m => m.userId === currentUser.id) : false;
    const hasUserRequested = userRequestedTeamIds.has(tid);
    const score = currentUser ? calculateSkillMatch(currentUser.skills, t.event_skills) : 50;

    return {
      id: tid,
      teamName: t.team_name,
      eventId: parseInt(t.event_id, 10),
      eventTitle: t.event_title,
      maxMembers: t.max_members,
      currentMemberCount: members.length,
      creatorId: parseInt(t.created_by, 10),
      creatorName: t.creator_name,
      creatorRegistrationNumber: t.creator_reg_no,
      isUserMember,
      hasUserRequested,
      skillMatchScore: score,
      members
    };
  });
}

// GET /api/teams & /api/teams/all
router.get(['/', '/all'], optionalAuth, async (req, res) => {
  try {
    const teams = await getFullTeamResponses('', [], req.user);
    res.json(teams);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/teams/event/:eventId
router.get('/event/:eventId', optionalAuth, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId, 10);
    const teams = await getFullTeamResponses('WHERE t.event_id = $1', [eventId], req.user);
    res.json(teams);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/teams (create team)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { eventId, teamName, maxMembers = 4 } = req.body || {};
    if (!eventId || !teamName) {
      return res.status(400).json({ success: false, message: 'Event ID and Team Name are required.' });
    }

    const eventRes = await db.query('SELECT id, title, team_size_min, team_size_max FROM events WHERE id = $1', [eventId]);
    if (eventRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Insert team
    const teamRes = await db.query(
      `INSERT INTO teams (event_id, created_by, team_name, max_members, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [eventId, req.user.id, teamName.trim(), maxMembers]
    );
    const newTeam = teamRes.rows[0];

    // Add creator as first active member
    await db.query(
      `INSERT INTO team_members (team_id, user_id, status, joined_at)
       VALUES ($1, $2, 'ACTIVE', NOW())`,
      [newTeam.id, req.user.id]
    );

    await logActivity(
      req.user.registrationNumber,
      req.user.name,
      req.user.role,
      'CREATE_TEAM',
      `Created team "${newTeam.team_name}" for event ID ${eventId}`,
      req
    );

    const fullTeam = await getFullTeamResponses('WHERE t.id = $1', [newTeam.id], req.user);
    res.json(fullTeam[0]);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/teams/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.id, 10);
    const teamRes = await db.query('SELECT * FROM teams WHERE id = $1', [teamId]);
    if (teamRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Team not found.' });
    }

    const team = teamRes.rows[0];
    const isCreator = parseInt(team.created_by, 10) === req.user.id;
    const isAdmin = req.user.role === 'ROLE_ADMIN' || req.user.role === 'ROLE_SUBADMIN';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Only the team creator or admin can delete this team.' });
    }

    await db.query('DELETE FROM teams WHERE id = $1', [teamId]);
    await logActivity(
      req.user.registrationNumber,
      req.user.name,
      req.user.role,
      'DELETE_TEAM',
      `Deleted team "${team.team_name}" (ID: ${teamId})`,
      req
    );

    res.json({ success: true, message: `Team "${team.team_name}" deleted successfully.` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/teams/request (join request)
router.post('/request', requireAuth, async (req, res) => {
  try {
    const { teamId } = req.body || {};
    if (!teamId) return res.status(400).json({ success: false, message: 'Team ID required.' });

    const teamRes = await db.query(
      `SELECT t.*, e.title AS event_title 
       FROM teams t JOIN events e ON t.event_id = e.id 
       WHERE t.id = $1`,
      [teamId]
    );
    if (teamRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Team not found.' });
    const team = teamRes.rows[0];

    // Check count of active members
    const countRes = await db.query("SELECT COUNT(*) FROM team_members WHERE team_id = $1 AND status = 'ACTIVE'", [teamId]);
    if (parseInt(countRes.rows[0].count, 10) >= team.max_members) {
      return res.status(400).json({ success: false, message: 'Team is already full.' });
    }

    // Check if already member
    const memRes = await db.query("SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'ACTIVE'", [teamId, req.user.id]);
    if (memRes.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'You are already a member of this team.' });
    }

    // Check if already requested
    const reqRes = await db.query("SELECT id FROM team_requests WHERE team_id = $1 AND requester_id = $2 AND status = 'PENDING'", [teamId, req.user.id]);
    if (reqRes.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'You have already sent a request to join this team.' });
    }

    // Insert request
    await db.query(
      `INSERT INTO team_requests (team_id, event_id, requester_id, status, created_at)
       VALUES ($1, $2, $3, 'PENDING', NOW())`,
      [teamId, team.event_id, req.user.id]
    );

    // Create notification for team leader
    await db.query(
      `INSERT INTO notifications (recipient_id, sender_id, title, message, type, link, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
      [
        team.created_by,
        req.user.id,
        '📩 New Team Join Request',
        `${req.user.name} (${req.user.registrationNumber}) requested to join your team "${team.team_name}" for "${team.event_title}".`,
        'TEAM_REQUEST',
        'teams'
      ]
    );

    res.json({ success: true, message: `Request to join team "${team.team_name}" submitted successfully!` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/teams/invite (invite teammate)
router.post('/invite', requireAuth, async (req, res) => {
  try {
    const { teamId, regNoOrName } = req.body || {};
    if (!teamId || !regNoOrName) {
      return res.status(400).json({ success: false, message: 'Team ID and student name/reg number are required.' });
    }

    const teamRes = await db.query(
      `SELECT t.*, e.title AS event_title 
       FROM teams t JOIN events e ON t.event_id = e.id 
       WHERE t.id = $1`,
      [teamId]
    );
    if (teamRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Team not found.' });
    const team = teamRes.rows[0];

    const userRes = await db.query(
      `SELECT id, registration_number, name, email FROM users 
       WHERE LOWER(registration_number) = LOWER($1) OR LOWER(name) = LOWER($1) 
       LIMIT 1`,
      [regNoOrName.trim()]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: `Student "${regNoOrName}" not found.` });
    }
    const student = userRes.rows[0];

    // Create notification
    await db.query(
      `INSERT INTO notifications (recipient_id, sender_id, title, message, type, link, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
      [
        student.id,
        req.user.id,
        '🤝 Team Invitation!',
        `${req.user.name} (${req.user.registrationNumber}) invited you to join team "${team.team_name}" for "${team.event_title}".`,
        'TEAM_INVITE',
        'teams'
      ]
    );

    res.json({ success: true, message: `Invitation sent to ${student.name} (${student.registration_number})!` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/teams/search-students
router.get('/search-students', async (req, res) => {
  try {
    const { query = '', filterBy = '', filterValue = '' } = req.query;
    const q = query.trim().toLowerCase();

    let sql = `SELECT registration_number, name, skills, department FROM users WHERE role = 'ROLE_STUDENT' AND status = 'ACTIVE'`;
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (LOWER(registration_number) LIKE $${params.length} OR LOWER(name) LIKE $${params.length})`;
    }

    if (filterBy === 'class' && filterValue) {
      params.push(`${filterValue.trim().toUpperCase()}%`);
      sql += ` AND UPPER(registration_number) LIKE $${params.length}`;
    } else if (filterBy === 'department' && filterValue) {
      params.push(filterValue.trim().toUpperCase());
      sql += ` AND UPPER(department) = $${params.length}`;
    }

    sql += ' LIMIT 10';
    const result = await db.query(sql, params);

    res.json(result.rows.map(r => ({
      registrationNumber: r.registration_number,
      name: r.name,
      skills: r.skills || '',
      department: r.department || ''
    })));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/teams/broadcast
router.post('/broadcast', requireAuth, async (req, res) => {
  try {
    const { teamId, filterType, filterValue } = req.body || {};
    if (!teamId || !filterType || !filterValue) {
      return res.status(400).json({ success: false, message: 'teamId, filterType, and filterValue required.' });
    }

    const teamRes = await db.query(
      `SELECT t.*, e.title AS event_title 
       FROM teams t JOIN events e ON t.event_id = e.id 
       WHERE t.id = $1`,
      [teamId]
    );
    if (teamRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Team not found.' });
    const team = teamRes.rows[0];

    let targetQuery = '';
    let targetParam = '';
    if (filterType === 'class') {
      targetQuery = "SELECT id, name, registration_number FROM users WHERE UPPER(registration_number) LIKE $1 AND status = 'ACTIVE'";
      targetParam = `${filterValue.trim().toUpperCase()}%`;
    } else if (filterType === 'department') {
      targetQuery = "SELECT id, name, registration_number FROM users WHERE UPPER(department) = $1 AND status = 'ACTIVE'";
      targetParam = filterValue.trim().toUpperCase();
    } else {
      return res.status(400).json({ success: false, message: 'Invalid filterType' });
    }

    const targets = await db.query(targetQuery, [targetParam]);

    for (const student of targets.rows) {
      if (student.id === req.user.id) continue;
      await db.query(
        `INSERT INTO notifications (recipient_id, sender_id, title, message, type, link, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
        [
          student.id,
          req.user.id,
          '📢 Broadcast Team Invitation',
          `Team "${team.team_name}" is looking for teammates for "${team.event_title}"! Click to check out and join.`,
          'BROADCAST_INVITE',
          'teams'
        ]
      );
    }

    res.json({ success: true, message: `Broadcast invitation dispatched to ${targets.rows.length} students!` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/teams/request/:id/respond
router.post('/request/:id/respond', requireAuth, async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { status } = req.body || {};

    const reqRes = await db.query(
      `SELECT tr.*, t.created_by, t.team_name, t.max_members, e.title AS event_title, u.name AS req_name
       FROM team_requests tr
       JOIN teams t ON tr.team_id = t.id
       JOIN events e ON tr.event_id = e.id
       JOIN users u ON tr.requester_id = u.id
       WHERE tr.id = $1`,
      [requestId]
    );

    if (reqRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Request not found.' });
    const r = reqRes.rows[0];

    if (parseInt(r.created_by, 10) !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only team leader can respond to join requests.' });
    }

    if (status === 'ACCEPTED') {
      const countRes = await db.query("SELECT COUNT(*) FROM team_members WHERE team_id = $1 AND status = 'ACTIVE'", [r.team_id]);
      if (parseInt(countRes.rows[0].count, 10) >= r.max_members) {
        return res.status(400).json({ success: false, message: 'Team is already full.' });
      }

      await db.query("UPDATE team_requests SET status = 'ACCEPTED' WHERE id = $1", [requestId]);
      await db.query(
        `INSERT INTO team_members (team_id, user_id, status, joined_at)
         VALUES ($1, $2, 'ACTIVE', NOW())
         ON CONFLICT DO NOTHING`,
        [r.team_id, r.requester_id]
      );

      // Notification
      await db.query(
        `INSERT INTO notifications (recipient_id, sender_id, title, message, type, link, is_read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`,
        [
          r.requester_id,
          req.user.id,
          '🎉 Join Request Accepted!',
          `${req.user.name} accepted your request to join team "${r.team_name}" for "${r.event_title}"!`,
          'REQUEST_ACCEPTED',
          'teams'
        ]
      );

      return res.json({ success: true, message: `Student ${r.req_name} accepted into team!` });
    } else {
      await db.query("UPDATE team_requests SET status = 'REJECTED' WHERE id = $1", [requestId]);
      return res.json({ success: true, message: 'Join request rejected.' });
    }
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/teams/leave/:teamId
router.post('/leave/:teamId', requireAuth, async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId, 10);
    await db.query("UPDATE team_members SET status = 'LEFT' WHERE team_id = $1 AND user_id = $2", [teamId, req.user.id]);
    res.json({ success: true, message: 'You have left the team.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/teams/requests/incoming
router.get('/requests/incoming', requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT tr.id, tr.team_id, tr.event_id, tr.status, tr.created_at,
             t.team_name, e.title AS event_title,
             u.registration_number AS requester_reg_no, u.name AS requester_name, u.skills AS requester_skills
      FROM team_requests tr
      JOIN teams t ON tr.team_id = t.id
      JOIN events e ON tr.event_id = e.id
      JOIN users u ON tr.requester_id = u.id
      WHERE t.created_by = $1 AND tr.status = 'PENDING'
      ORDER BY tr.created_at DESC
    `;
    const result = await db.query(query, [req.user.id]);

    const dtos = result.rows.map(r => ({
      id: parseInt(r.id, 10),
      teamId: parseInt(r.team_id, 10),
      teamName: r.team_name,
      eventId: parseInt(r.event_id, 10),
      eventTitle: r.event_title,
      requesterRegistrationNumber: r.requester_reg_no,
      requesterName: r.requester_name,
      requesterSkills: r.requester_skills || '',
      status: r.status,
      createdAt: r.created_at
    }));

    res.json(dtos);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/teams/requests/sent
router.get('/requests/sent', requireAuth, async (req, res) => {
  try {
    const query = `
      SELECT tr.id, tr.team_id, tr.event_id, tr.status, tr.created_at,
             t.team_name, e.title AS event_title,
             u.registration_number AS requester_reg_no, u.name AS requester_name, u.skills AS requester_skills
      FROM team_requests tr
      JOIN teams t ON tr.team_id = t.id
      JOIN events e ON tr.event_id = e.id
      JOIN users u ON tr.requester_id = u.id
      WHERE tr.requester_id = $1
      ORDER BY tr.created_at DESC
    `;
    const result = await db.query(query, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
