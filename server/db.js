const { Pool } = require('pg');
require('dotenv').config();

function buildPoolConfig() {
  let connectionString = process.env.DATABASE_URL || process.env.DB_URL;

  if (connectionString) {
    if (connectionString.startsWith('jdbc:')) {
      connectionString = connectionString.substring(5);
    }

    // If username and password are provided separately from DB_URL
    try {
      const url = new URL(connectionString);
      if (process.env.DB_USERNAME && !url.username) {
        url.username = process.env.DB_USERNAME;
      }
      if (process.env.DB_PASSWORD && !url.password) {
        url.password = process.env.DB_PASSWORD;
      }
      connectionString = url.toString();
    } catch (e) {
      // Keep as-is if parsing fails
    }

    return {
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    };
  }

  // Fallback to individual connection parameters
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
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
