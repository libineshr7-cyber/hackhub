const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || '404E635266556A586E3272357538782F413F4428472B4B6250655368566D5971';

async function verifyTokenAndGetUser(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const regNo = decoded.sub || decoded.registrationNumber;
    if (!regNo) return null;

    const res = await db.query(
      'SELECT id, registration_number, name, email, role, skills, department, assigned_year, student_limit, status, first_login FROM users WHERE LOWER(registration_number) = LOWER($1)',
      [regNo]
    );

    if (res.rows.length === 0) return null;
    const user = res.rows[0];
    if (user.status === 'INACTIVE') return null;

    return {
      id: parseInt(user.id, 10),
      registrationNumber: user.registration_number,
      name: user.name,
      email: user.email,
      role: user.role,
      skills: user.skills,
      department: user.department,
      assignedYear: user.assigned_year,
      studentLimit: user.student_limit,
      status: user.status,
      firstLogin: user.first_login
    };
  } catch (err) {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token required.' });
  }

  const user = await verifyTokenAndGetUser(token);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }

  req.user = user;
  next();
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (token) {
    req.user = await verifyTokenAndGetUser(token);
  } else {
    req.user = null;
  }
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions.' });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  JWT_SECRET
};
