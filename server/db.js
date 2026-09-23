const { Pool } = require('pg');
require('dotenv').config();

function buildPoolConfig() {
  let rawUrl = process.env.DATABASE_URL || process.env.DB_URL;
  let host = process.env.DB_HOST || 'localhost';
  let port = parseInt(process.env.DB_PORT || '5432', 10);
  let database = process.env.DB_NAME || 'postgres';
  let user = process.env.DB_USERNAME || 'postgres';
  let password = process.env.DB_PASSWORD || '';

  if (rawUrl) {
    if (rawUrl.startsWith('jdbc:')) {
      rawUrl = rawUrl.substring(5);
    }
    try {
      const parsed = new URL(rawUrl);
      if (parsed.hostname) host = parsed.hostname;
      if (parsed.port) port = parseInt(parsed.port, 10);
      if (parsed.pathname && parsed.pathname.length > 1) {
        database = parsed.pathname.substring(1);
      }
      if (parsed.username && !process.env.DB_USERNAME) {
        user = decodeURIComponent(parsed.username);
      }
      if (parsed.password && !process.env.DB_PASSWORD) {
        password = decodeURIComponent(parsed.password);
      }
    } catch (e) {
      console.warn('URL parsing fallback:', e.message);
    }
  }

  // Environment variables take precedence if explicitly provided
  if (process.env.DB_USERNAME) user = process.env.DB_USERNAME;
  if (process.env.DB_PASSWORD) password = process.env.DB_PASSWORD;

  return {
    host,
    port,
    database,
    user,
    password,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  };
}

const pool = new Pool(buildPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool
};
