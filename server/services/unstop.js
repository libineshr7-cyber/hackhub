const https = require('https');
const db = require('../db');

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseDate(dateStr, fallback) {
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {}
  return fallback;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 10000
    };

    const req = https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse JSON response: ' + e.message));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode} from Unstop`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout connecting to Unstop'));
    });
  });
}

async function syncUnstopEvents() {
  console.log('🔄 Starting Unstop Hackathons & Competitions live sync...');

  // Get Admin user to attribute imported events
  let adminId = 1;
  try {
    const adminRes = await db.query("SELECT id FROM users WHERE role = 'ROLE_ADMIN' ORDER BY id ASC LIMIT 1");
    if (adminRes.rows.length > 0) {
      adminId = adminRes.rows[0].id;
    }
  } catch (e) {}

  const categories = ['hackathons', 'competitions'];
  const maxPages = 4; // 4 pages x 50 items = up to 400 events
  let syncedCount = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Cutoff date for registration: 3 days ago
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  for (const category of categories) {
    for (let page = 1; page <= maxPages; page++) {
      const url = `https://unstop.com/api/public/opportunity/search-result?opportunity=${category}&per_page=50&page=${page}`;
      try {
        const json = await fetchJson(url);
        const items = json?.data?.data || [];
        if (!Array.isArray(items) || items.length === 0) break;

        for (const item of items) {
          try {
            const title = (item.title || '').trim();
            if (!title) continue;

            const seoUrl = (item.seo_url || item.short_url || '').trim();
            let regLink = seoUrl ? (seoUrl.startsWith('http') ? seoUrl : `https://unstop.com/${seoUrl}`) : 'https://unstop.com/hackathons';

            // Dates
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            const endFallback = new Date(today);
            endFallback.setDate(endFallback.getDate() + 30);
            const endFallbackStr = endFallback.toISOString().split('T')[0];

            const startDate = parseDate(item.start_date, tomorrowStr);
            const endDate = parseDate(item.end_date, endFallbackStr);

            const regnReq = item.regnRequirements || {};
            const rawDeadline = regnReq.end_regn_dt || item.end_regn_dt || item.regn_end_date || item.application_close_date;
            const regDeadline = parseDate(rawDeadline, endDate);

            // Filter ended events:
            // 1. Event end date must NOT be in the past
            const endD = new Date(endDate);
            if (endD < today) continue;

            // 2. Registration deadline must NOT be older than 3 days ago
            const deadD = new Date(regDeadline);
            if (deadD < threeDaysAgo) continue;

            // 3. Status checks
            const regStatus = (item.registerStatus || '').toLowerCase();
            const oppStatus = (item.status || '').toLowerCase();
            if (regStatus.includes('closed') || regStatus.includes('expired') || oppStatus.includes('archived')) {
              // If registration closed more than 3 days ago, skip
              if (deadD < threeDaysAgo) continue;
            }

            // Description
            let desc = stripHtml(item.details || '');
            if (desc.length > 500) desc = desc.substring(0, 500) + '...';
            if (!desc) desc = 'Live Hackathon featured on Unstop platform. Explore challenge tracks, form your team, and build innovative solutions!';
            desc += '\n\n🌐 (Verified live opportunity from Unstop)';

            // Poster
            const logo = (item.logoUrl2 || '').trim();
            const posterPath = (logo && logo.startsWith('http')) 
              ? logo 
              : 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80';

            // Mode
            const region = (item.region || 'online').toLowerCase();
            let mode = 'ONLINE';
            if (region.includes('offline')) mode = 'OFFLINE';
            else if (region.includes('hybrid')) mode = 'HYBRID';

            // Team size
            const minTeam = Math.max(1, parseInt(regnReq.min_team_size, 10) || 1);
            const maxTeam = Math.max(minTeam, parseInt(regnReq.max_team_size, 10) || 4);

            // Venue
            const orgName = (item.organisation?.name || 'Unstop Partner').trim();
            const venue = `${orgName} (Unstop)`;

            // Skills
            let skills = 'Hackathon, Coding, Problem Solving, Unstop';
            if (Array.isArray(item.required_skills) && item.required_skills.length > 0) {
              const skillNames = item.required_skills.map(s => s.skill).filter(Boolean);
              if (skillNames.length > 0) {
                skills = skillNames.join(', ') + ', Unstop';
              }
            }

            const eventType = category === 'competitions' ? 'COMPETITION' : 'HACKATHON';

            // Upsert into PostgreSQL
            const existingRes = await db.query('SELECT id FROM events WHERE registration_link = $1 LIMIT 1', [regLink]);
            if (existingRes.rows.length > 0) {
              await db.query(
                `UPDATE events 
                 SET title = $1, description = $2, start_date = $3, end_date = $4,
                     registration_deadline = $5, poster_path = $6, mode = $7,
                     venue = $8, skills = $9, updated_at = NOW()
                 WHERE id = $10`,
                [title, desc, startDate, endDate, regDeadline, posterPath, mode, venue, skills, existingRes.rows[0].id]
              );
            } else {
              await db.query(
                `INSERT INTO events (
                   title, description, event_type, team_size_min, team_size_max,
                   start_date, end_date, registration_deadline, poster_path,
                   registration_link, mode, venue, skills, created_by, created_at, updated_at
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
                [title, desc, eventType, minTeam, maxTeam, startDate, endDate, regDeadline, posterPath, regLink, mode, venue, skills, adminId]
              );
              syncedCount++;
            }
          } catch (itemErr) {
            // Continue processing remaining items
          }
        }
      } catch (pageErr) {
        console.warn(`Unstop ${category} page ${pageErr.message}`);
        break;
      }
    }
  }

  console.log(`✅ Unstop Sync completed! Added ${syncedCount} new live events.`);
  return syncedCount;
}

module.exports = { syncUnstopEvents };
