const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const { logActivity } = require('../services/logger');
const { sendOtpEmail } = require('../services/mail');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { registrationNumber, password } = req.body || {};
    if (!registrationNumber || !password) {
      return res.status(400).json({ success: false, message: 'Registration number/name and password are required.' });
    }

    const trimmedInput = registrationNumber.trim();

    // Support login by registration_number or exact name match
    const result = await db.query(
      `SELECT * FROM users WHERE LOWER(registration_number) = LOWER($1) OR LOWER(name) = LOWER($1) LIMIT 1`,
      [trimmedInput]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const user = result.rows[0];

    if (user.status === 'INACTIVE') {
      return res.status(400).json({ success: false, message: 'Your account is deactivated. Contact department admin.' });
    }

    // Verify password with BCrypt
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      // Support legacy default check if user password is '123'
      if (password !== '123' || !user.first_login) {
        return res.status(400).json({ success: false, message: 'Invalid credentials. Check your password.' });
      }
    }

    // Generate JWT token (valid for 30 days)
    const token = jwt.sign(
      {
        sub: user.registration_number,
        id: user.id,
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    await logActivity(user.registration_number, user.name, user.role, 'LOGIN', 'User logged in successfully', req);

    res.json({
      token,
      type: 'Bearer',
      id: parseInt(user.id, 10),
      registrationNumber: user.registration_number,
      name: user.name,
      email: user.email,
      role: user.role,
      firstLogin: user.first_login,
      skills: user.skills || '',
      department: user.department || ''
    });
  } catch (err) {
    console.error('Login error:', err);
    const detail = err.message ? `Login failed: ${err.message}` : 'An unexpected error occurred during login.';
    res.status(500).json({ success: false, message: detail });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are required.' });
    }
    if (newPassword.length < 3) {
      return res.status(400).json({ success: false, message: 'New password must be at least 3 characters.' });
    }

    const userRes = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const validCurrent = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!validCurrent && currentPassword !== '123') {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = $1, first_login = false, updated_at = NOW() WHERE id = $2',
      [newHash, req.user.id]
    );

    await logActivity(req.user.registrationNumber, req.user.name, req.user.role, 'CHANGE_PASSWORD', 'Password updated successfully', req);

    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/auth/forgot-password/request-otp
router.post('/forgot-password/request-otp', async (req, res) => {
  try {
    const { registrationNumber, email } = req.body || {};
    if (!registrationNumber) {
      return res.status(400).json({ success: false, message: 'Registration number is required.' });
    }

    const userRes = await db.query(
      'SELECT id, registration_number, name, email FROM users WHERE LOWER(registration_number) = LOWER($1)',
      [registrationNumber.trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No account found with this registration number.' });
    }

    const user = userRes.rows[0];
    const targetEmail = (email && email.trim()) || user.email;

    if (!targetEmail || !targetEmail.includes('@')) {
      return res.status(400).json({ success: false, message: 'Please provide a valid personal email address.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Expires in 5 minutes
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Store in otp_requests table
    await db.query(
      `INSERT INTO otp_requests (user_id, otp_hash, expires_at, attempts, used, created_at)
       VALUES ($1, $2, $3, 0, false, NOW())`,
      [user.id, otpHash, expiresAt]
    );

    // If user's stored email was empty or different, update it
    if (!user.email || user.email.includes('@college.edu')) {
      await db.query('UPDATE users SET email = $1 WHERE id = $2', [targetEmail, user.id]);
    }

    await sendOtpEmail(targetEmail, user.registration_number, otp);

    res.json({
      success: true,
      message: 'OTP dispatched successfully!',
      data: {
        registrationNumber: user.registration_number,
        email: targetEmail
      }
    });
  } catch (err) {
    console.error('Request OTP error:', err);
    res.status(400).json({ success: false, message: err.message || 'Failed to process OTP request.' });
  }
});

// POST /api/auth/forgot-password/verify-otp
router.post('/forgot-password/verify-otp', async (req, res) => {
  try {
    const { registrationNumber, otp, newPassword } = req.body || {};
    if (!registrationNumber || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Registration number, OTP, and new password are required.' });
    }

    const userRes = await db.query(
      'SELECT id, registration_number, name, role FROM users WHERE LOWER(registration_number) = LOWER($1)',
      [registrationNumber.trim()]
    );

    if (userRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'User not found.' });
    }

    const user = userRes.rows[0];

    // Find latest unused, non-expired OTP for this user
    const otpRes = await db.query(
      `SELECT * FROM otp_requests 
       WHERE user_id = $1 AND used = false AND expires_at > NOW() 
       ORDER BY id DESC LIMIT 1`,
      [user.id]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'OTP has expired or is invalid. Please request a new code.' });
    }

    const otpRecord = otpRes.rows[0];
    const otpValid = await bcrypt.compare(otp.trim(), otpRecord.otp_hash);

    if (!otpValid) {
      await db.query('UPDATE otp_requests SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Please try again.' });
    }

    // Mark OTP as used
    await db.query('UPDATE otp_requests SET used = true WHERE id = $1', [otpRecord.id]);

    // Update password
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = $1, first_login = false, updated_at = NOW() WHERE id = $2',
      [newHash, user.id]
    );

    await logActivity(user.registration_number, user.name, user.role, 'PASSWORD_RESET', 'Password reset successfully via OTP', req);

    res.json({ success: true, message: 'Password reset successfully! You can now log in.' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(400).json({ success: false, message: err.message || 'Failed to verify OTP.' });
  }
});

module.exports = router;
