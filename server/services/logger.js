const db = require('../db');

async function logActivity(userRegNo, userName, userRole, action, details, req = null) {
  try {
    let ip = '127.0.0.1';
    if (req) {
      ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
    }
    const query = `
      INSERT INTO activity_logs (user_reg_no, user_name, user_role, action, details, ip_address, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `;
    await db.query(query, [
      userRegNo || 'SYSTEM',
      userName || 'System',
      userRole || 'ANONYMOUS',
      action || 'UNKNOWN',
      (details || '').substring(0, 2000),
      ip
    ]);
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
}

module.exports = { logActivity };
