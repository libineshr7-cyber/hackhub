const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('../services/logger');

// GET /api/user/profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userRes = await db.query(
      'SELECT id, registration_number, name, email, role, skills, department, assigned_year, student_limit, status, first_login FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const u = userRes.rows[0];
    res.json({
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
      firstLogin: u.first_login
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/user/profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, email, skills } = req.body || {};
    const updatedName = name ? name.trim() : req.user.name;
    const updatedEmail = email ? email.trim() : req.user.email;
    const updatedSkills = skills !== undefined ? skills.trim() : (req.user.skills || '');

    await db.query(
      `UPDATE users 
       SET name = $1, email = $2, skills = $3, updated_at = NOW() 
       WHERE id = $4`,
      [updatedName, updatedEmail, updatedSkills, req.user.id]
    );

    await logActivity(
      req.user.registrationNumber,
      updatedName,
      req.user.role,
      'UPDATE_PROFILE',
      `Updated profile: Name="${updatedName}", Skills="${updatedSkills}"`,
      req
    );

    res.json({
      id: req.user.id,
      registrationNumber: req.user.registrationNumber,
      name: updatedName,
      email: updatedEmail,
      role: req.user.role,
      skills: updatedSkills,
      department: req.user.department || '',
      assignedYear: req.user.assignedYear || '',
      studentLimit: req.user.studentLimit,
      status: req.user.status,
      firstLogin: req.user.firstLogin
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
