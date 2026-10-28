/*
 * Greenwich Wishes server - PostgreSQL database on Docker / local.
 *
 *   node server.js
 *
 * Configuration (environment variables or a .env file next to this file):
 *   PORT              default 8780
 *   DATABASE_URL      postgres://postgres:postgres123@localhost:5432/greenwich_wishes
 *   PUBLIC_URL        public address, e.g. https://wishes.example.edu.vn  (used for Facebook share tags)
 *   ADMIN_PASSPHRASE  secret typed into the search box to unlock admin mode (default: admingreenwich)
 *   TRUST_PROXY=1     when running behind nginx / Caddy / Cloudflare (real client IP + https cookies)
 *   DATA_DIR          where uploaded photos live (default ./data)
 *   COOKIE_SECRET     optional; otherwise generated once into DATA_DIR/secret.key
 *   SEED_DEMO=1       fill an EMPTY database with demo wishes
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { Pool } = require('pg');

const ROOT = __dirname;

/* ---------- tiny .env loader (no dependency) ---------- */
try {
    fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/).forEach(line => {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
        if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    });
} catch (e) { /* no .env file */ }

const PORT = +process.env.PORT || 8780;
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const UPLOADS = path.join(DATA_DIR, 'uploads');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const PASSPHRASE = process.env.ADMIN_PASSPHRASE || 'admingreenwich';
const ADMIN_TTL = 12 * 3600 * 1000;
const MAX_BODY = 6 * 1024 * 1024;        // JSON body: cropped photo + rendered card (base64)
const MAX_IMAGE = 1.5 * 1024 * 1024;     // each decoded JPEG
fs.mkdirSync(UPLOADS, { recursive: true });

// A public site must not run with the well-known default / placeholder passphrase: refuse to start instead of exposing admin.
if (!process.env.ADMIN_PASSPHRASE || /^CHANGE-ME/i.test(PASSPHRASE)) {
    const msg = 'ADMIN_PASSPHRASE is not set (or still the CHANGE-ME placeholder). Set your own long secret phrase in .env.';
    if (PUBLIC_URL.startsWith('https://')) { console.error('[x] ' + msg + ' Refusing to start a public site without it.'); process.exit(1); }
    console.warn('[!] ' + msg + ' Using the built-in default: fine for local testing only.');
} else if (PASSPHRASE === 'admingreenwich') {
    console.warn('[!] ADMIN_PASSPHRASE is the well-known default "admingreenwich": anyone who has read the docs can try it. Use a longer secret.');
}
if (/example\.(edu\.vn|com)/.test(PUBLIC_URL)) console.warn('[!] PUBLIC_URL still looks like the example value (' + PUBLIC_URL + '): Facebook share links will be wrong.');

/* ---------- shared reference data (countries/cities) comes from the same file the browser uses ---------- */
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8'), ctx);
const GW_DATA = ctx.window.GW_DATA;
const ROLES = ['student', 'alumni', 'staff', 'parent', 'partner'];
const CAMPUSES = ['hn', 'dn', 'hcm', 'ct', 'uk', 'global'];

/* ---------- database: PostgreSQL ---------- */
const DATABASE_URL = process.env.DATABASE_URL ||
    `postgres://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres123'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'greenwich_wishes'}`;

const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

process.on('exit', () => { try { pool.end(); } catch (e) { } });

async function initDb(retries = 15, delay = 2000) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Connecting to PostgreSQL (${DATABASE_URL.replace(/:[^:@]+@/, ':***@')})...`);
            await pool.query(`
                CREATE TABLE IF NOT EXISTS wishes (
                    id VARCHAR(64) PRIMARY KEY,
                    device_id VARCHAR(64) UNIQUE,
                    name VARCHAR(255) NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    campus VARCHAR(50) NOT NULL,
                    country VARCHAR(10) NOT NULL,
                    city VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    theme VARCHAR(50),
                    image TEXT,
                    card_image TEXT,
                    hidden INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS likes (
                    wish_id VARCHAR(64) NOT NULL,
                    device_id VARCHAR(64) NOT NULL,
                    PRIMARY KEY (wish_id, device_id)
                );
                CREATE TABLE IF NOT EXISTS seed_hearts (
                    wish_id VARCHAR(64) PRIMARY KEY,
                    n INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_wishes_created_at ON wishes (created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_likes_wish_id ON likes (wish_id);
            `);
            console.log('[✓] PostgreSQL schema initialized successfully.');

            const cRes = await pool.query('SELECT COUNT(*)::int AS n FROM wishes');
            const count = cRes.rows[0].n;

            // Auto-migrate from existing SQLite data if gw.db exists and PostgreSQL is empty
            let migrated = false;
            const sqlitePath = path.join(DATA_DIR, 'gw.db');
            if (count === 0 && fs.existsSync(sqlitePath)) {
                try {
                    const { DatabaseSync } = require('node:sqlite');
                    const sqldb = new DatabaseSync(sqlitePath);
                    const wishes = sqldb.prepare('SELECT * FROM wishes').all();
                    const likes = sqldb.prepare('SELECT * FROM likes').all();
                    const seedHearts = sqldb.prepare('SELECT * FROM seed_hearts').all();
                    if (wishes.length > 0) {
                        console.log(`[i] Migrating ${wishes.length} wishes from SQLite (gw.db) to PostgreSQL...`);
                        const client = await pool.connect();
                        try {
                            await client.query('BEGIN');
                            for (const w of wishes) {
                                await client.query(
                                    `INSERT INTO wishes (id, device_id, name, role, campus, country, city, message, theme, image, card_image, created_at)
                                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                                     ON CONFLICT (id) DO NOTHING`,
                                    [w.id, w.device_id, w.name, w.role, w.campus, w.country, w.city, w.message, w.theme, w.image, w.card_image, w.created_at]
                                );
                            }
                            for (const l of likes) {
                                await client.query(`INSERT INTO likes (wish_id, device_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [l.wish_id, l.device_id]);
                            }
                            for (const s of seedHearts) {
                                await client.query(`INSERT INTO seed_hearts (wish_id, n) VALUES ($1, $2) ON CONFLICT (wish_id) DO UPDATE SET n = EXCLUDED.n`, [s.wish_id, s.n]);
                            }
                            await client.query('COMMIT');
                            console.log(`[✓] Successfully migrated ${wishes.length} wishes to PostgreSQL!`);
                            migrated = true;
                        } catch (e) {
                            await client.query('ROLLBACK');
                            console.error('[!] Migration error:', e.message);
                        } finally {
                            client.release();
                            try { sqldb.close(); } catch (_) { }
                        }
                    }
                } catch (e) {
                    console.warn('[!] SQLite auto-migration skipped:', e.message);
                }
            }

            // Seed demo data if SEED_DEMO=1 and PostgreSQL is still empty
            if (!migrated && count === 0 && process.env.SEED_DEMO === '1') {
                console.log('[i] Seeding demo wishes into PostgreSQL...');
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    for (const w of GW_DATA.wishes) {
                        await client.query(
                            `INSERT INTO wishes (id, device_id, name, role, campus, country, city, message, theme, image, card_image, created_at)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                             ON CONFLICT (id) DO NOTHING`,
                            [w.id, null, w.name, w.role, w.campus, w.country, w.city, w.message, w.theme, null, null, w.createdAt]
                        );
                        await client.query(
                            `INSERT INTO seed_hearts (wish_id, n) VALUES ($1, $2) ON CONFLICT (wish_id) DO UPDATE SET n = EXCLUDED.n`,
                            [w.id, w.hearts || 0]
                        );
                    }
                    await client.query('COMMIT');
                    console.log(`[✓] Seeded ${GW_DATA.wishes.length} demo wishes into PostgreSQL.`);
                } catch (e) {
                    await client.query('ROLLBACK');
                    console.error('[!] Error seeding demo wishes:', e.message);
                } finally {
                    client.release();
                }
            }
            return;
        } catch (err) {
            console.warn(`[!] PostgreSQL connection attempt ${i + 1}/${retries} failed: ${err.message}. Retrying in ${delay / 1000}s...`);
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

const q = {
    list: async (device) => {
        const res = await pool.query(
            `SELECT w.*,
                    (SELECT COUNT(*)::int FROM likes l WHERE l.wish_id = w.id) + COALESCE((SELECT n FROM seed_hearts s WHERE s.wish_id = w.id), 0) AS hearts,
                    EXISTS(SELECT 1 FROM likes l WHERE l.wish_id = w.id AND l.device_id = $1) AS liked
             FROM wishes w
             WHERE w.hidden = 0
             ORDER BY w.created_at DESC`,
            [device || '']
        );
        return res.rows;
    },
    byId: async (id) => {
        const res = await pool.query('SELECT * FROM wishes WHERE id = $1 AND hidden = 0', [id]);
        return res.rows[0] || null;
    },
    byDevice: async (device) => {
        const res = await pool.query('SELECT id FROM wishes WHERE device_id = $1', [device]);
        return res.rows[0] || null;
    },
    insert: async (id, device_id, name, role, campus, country, city, message, theme, image, card_image, created_at) => {
        await pool.query(
            `INSERT INTO wishes (id, device_id, name, role, campus, country, city, message, theme, image, card_image, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [id, device_id, name, role, campus, country, city, message, theme, image, card_image, created_at]
        );
    },
    update: async (name, role, campus, country, city, message, image, card_image, id) => {
        await pool.query(
            `UPDATE wishes SET name = $1, role = $2, campus = $3, country = $4, city = $5, message = $6, image = $7, card_image = $8 WHERE id = $9`,
            [name, role, campus, country, city, message, image, card_image, id]
        );
    },
    remove: async (id) => {
        await pool.query('DELETE FROM wishes WHERE id = $1', [id]);
    },
    removeLikes: async (wish_id) => {
        await pool.query('DELETE FROM likes WHERE wish_id = $1', [wish_id]);
    },
    removeSeed: async (wish_id) => {
        await pool.query('DELETE FROM seed_hearts WHERE wish_id = $1', [wish_id]);
    },
    count: async () => {
        const res = await pool.query('SELECT COUNT(*)::int AS n FROM wishes');
        return res.rows[0].n;
    },
    hasLike: async (wish_id, device_id) => {
        const res = await pool.query('SELECT 1 FROM likes WHERE wish_id = $1 AND device_id = $2', [wish_id, device_id]);
        return res.rowCount > 0;
    },
    addLike: async (wish_id, device_id) => {
        await pool.query('INSERT INTO likes (wish_id, device_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [wish_id, device_id]);
    },
    delLike: async (wish_id, device_id) => {
        await pool.query('DELETE FROM likes WHERE wish_id = $1 AND device_id = $2', [wish_id, device_id]);
    },
    heartCount: async (wish_id) => {
        const res = await pool.query(
            `SELECT (SELECT COUNT(*)::int FROM likes WHERE wish_id = $1) + COALESCE((SELECT n FROM seed_hearts WHERE wish_id = $1), 0) AS n`,
            [wish_id]
        );
        return res.rows[0].n;
    },
    seedHearts: async (wish_id, n) => {
        await pool.query('INSERT INTO seed_hearts (wish_id, n) VALUES ($1, $2) ON CONFLICT (wish_id) DO UPDATE SET n = EXCLUDED.n', [wish_id, n]);
    }
};

/* ---------- identity: visitor device cookie + admin cookie (both signed, HttpOnly) ---------- */
const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
const SECRET = process.env.COOKIE_SECRET || (fs.existsSync(SECRET_FILE) ? fs.readFileSync(SECRET_FILE, 'utf8')
    : (() => { const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(SECRET_FILE, s, { mode: 0o600 }); return s; })());
const sign = v => crypto.createHmac('sha256', SECRET).update(v).digest('hex').slice(0, 32);
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const isHttps = req => (req.headers['x-forwarded-proto'] || '').includes('https') || PUBLIC_URL.startsWith('https');

function parseCookies(req) {
    const out = {};
    (req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
    return out;
}
function addCookie(res, line) {
    const prev = res.getHeader('Set-Cookie');
    res.setHeader('Set-Cookie', prev ? [].concat(prev, line) : line);
}
function deviceOf(req, res) {
    const c = parseCookies(req).gw_did;
    if (c) {
        const [id, sig] = c.split('.');
        if (id && sig && safeEq(sig, sign(id))) return id;
    }
    const id = crypto.randomUUID();
    addCookie(res, `gw_did=${id}.${sign(id)}; Path=/; Max-Age=315360000; HttpOnly; SameSite=Lax${isHttps(req) ? '; Secure' : ''}`);
    return id;
}
function isAdmin(req) {
    const c = parseCookies(req).gw_admin;
    if (!c) return false;
    const [exp, sig] = c.split('.');
    return !!(exp && sig && +exp > Date.now() && safeEq(sig, sign('admin:' + exp)));
}
function setAdminCookie(req, res, on) {
    const exp = Date.now() + ADMIN_TTL;
    const val = on ? `${exp}.${sign('admin:' + exp)}` : '';
    addCookie(res, `gw_admin=${val}; Path=/; Max-Age=${on ? ADMIN_TTL / 1000 : 0}; HttpOnly; SameSite=Strict${isHttps(req) ? '; Secure' : ''}`);
}

/* ---------- tiny rate limiter (per IP, in memory) ---------- */
const hits = new Map();
function limited(ip, bucket, max, windowMs) {
    const key = bucket + '|' + ip, now = Date.now();
    const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
    arr.push(now); hits.set(key, arr);
    return arr.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();
const clientIp = req => TRUST_PROXY ? (req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress) : req.socket.remoteAddress;

/* ---------- helpers ---------- */
const MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon'
};
const PUBLIC_FILES = /^\/(index\.html|create\.html|favicon\.ico|favicon-\d+\.png|apple-touch-icon\.png|(css|js|images)\/.+)$/;
const fail = (status, error, extra) => Object.assign(new Error(error), { status, body: Object.assign({ error }, extra) });

function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
}
function readJson(req) {
    return new Promise((resolve, reject) => {
        let size = 0; const chunks = [];
        req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(fail(413, 'too_large')); req.destroy(); } else chunks.push(c); });
        req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(fail(400, 'bad_json')); } });
        req.on('error', reject);
    });
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function jpegFrom(dataUrl, errCode) {
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
    if (!m) throw fail(400, errCode);
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > MAX_IMAGE) throw fail(413, 'image_too_large');
    if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw fail(400, 'image_invalid');
    return buf;
}
function saveJpeg(buf, id, kind) {
    const name = `${id}-${kind}-${crypto.randomBytes(4).toString('hex')}.jpg`;
    fs.writeFileSync(path.join(UPLOADS, name), buf);
    return '/uploads/' + name;
}
function unlinkUpload(url) {
    const m = /^\/uploads\/([\w-]+\.jpg)$/.exec(url || '');
    if (m) fs.unlink(path.join(UPLOADS, m[1]), () => { });
}
function validatedFields(b, current) {
    const country = GW_DATA.countries[b.country == null && current ? current.country : b.country];
    const pick = (k, max) => clean(b[k] == null && current ? current[k] : b[k], max);
    const f = {
        name: pick('name', 40), message: pick('message', 220), role: b.role == null && current ? current.role : b.role,
        campus: b.campus == null && current ? current.campus : b.campus, country: b.country == null && current ? current.country : b.country
    };
    if (!f.name || !f.message || !country || !ROLES.includes(f.role) || !CAMPUSES.includes(f.campus)) throw fail(400, 'invalid');
    // keep the city when the country is unchanged, otherwise use the country's main city
    f.city = current && current.country === f.country ? current.city : country[6][0][0];
    return f;
}
function publicWish(r, device) {
    if (!r) return null;
    return {
        id: r.id, name: r.name, role: r.role, campus: r.campus, country: r.country, city: r.city, message: r.message,
        theme: r.theme, image: r.image, hearts: parseInt(r.hearts, 10) || 0, liked: !!r.liked,
        mine: !!device && r.device_id === device,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at || '')
    };
}
async function listOne(id, device) {
    const res = await pool.query(
        `SELECT w.*,
                (SELECT COUNT(*)::int FROM likes l WHERE l.wish_id = w.id) + COALESCE((SELECT n FROM seed_hearts s WHERE s.wish_id = w.id), 0) AS hearts,
                EXISTS(SELECT 1 FROM likes l WHERE l.wish_id = w.id AND l.device_id = $1) AS liked
         FROM wishes w
         WHERE w.id = $2`,
        [device || '', id]
    );
    return res.rows[0] || null;
}

/* ---------- API ---------- */
async function api(req, res, url) {
    const device = deviceOf(req, res);
    const ip = clientIp(req);
    const admin = isAdmin(req);

    // state-changing requests must come from this site (blocks cross-site form posts)
    if (req.method !== 'GET' && req.headers.origin) {
        let host = ''; try { host = new URL(req.headers.origin).host; } catch (e) { }
        const ok = [req.headers['x-forwarded-host'], req.headers.host, PUBLIC_URL && new URL(PUBLIC_URL).host].filter(Boolean).includes(host);
        if (!ok) return json(res, 403, { error: 'bad_origin' });
    }

    if (url.pathname === '/api/me' && req.method === 'GET') {
        const mine = await q.byDevice(device);
        return json(res, 200, { posted: !!mine, wishId: mine ? mine.id : null });
    }

    /* --- admin session --- */
    if (url.pathname === '/api/admin/me' && req.method === 'GET') return json(res, 200, { admin });
    if (url.pathname === '/api/admin/logout' && req.method === 'POST') { setAdminCookie(req, res, false); return json(res, 200, { admin: false }); }
    if (url.pathname === '/api/admin/login' && req.method === 'POST') {
        if (limited(ip, 'login', 8, 600e3)) return json(res, 429, { error: 'rate_limited' });
        const b = await readJson(req);
        const h = s => crypto.createHash('sha256').update(String(s)).digest('hex');
        if (!safeEq(h(b.passphrase), h(PASSPHRASE))) return json(res, 401, { error: 'wrong_passphrase' });
        setAdminCookie(req, res, true);
        return json(res, 200, { admin: true });
    }

    const m = url.pathname.match(/^\/api\/wishes(?:\/([\w-]+))?(?:\/(like))?$/);
    if (!m) return json(res, 404, { error: 'not_found' });

    // GET /api/wishes
    if (!m[1] && req.method === 'GET') {
        const rows = await q.list(device);
        return json(res, 200, rows.map(r => publicWish(r, device)));
    }

    // POST /api/wishes   (visitors: once per device;  admin: unlimited)
    if (!m[1] && req.method === 'POST') {
        if (!admin) {
            if (limited(ip, 'post', 20, 3600e3)) return json(res, 429, { error: 'rate_limited' });
            const mine = await q.byDevice(device);
            if (mine) return json(res, 409, { error: 'already_posted', wishId: mine.id });
        }
        const b = await readJson(req);
        const f = validatedFields(b, null);
        const photo = jpegFrom(b.image, 'image_required');
        const card = b.cardImage ? jpegFrom(b.cardImage, 'card_invalid') : null;
        const id = 'u' + crypto.randomBytes(6).toString('hex');
        const image = saveJpeg(photo, id, 'photo');
        const cardImage = card ? saveJpeg(card, id, 'card') : null;
        try {
            await q.insert(id, admin ? null : device, f.name, f.role, f.campus, f.country, f.city, f.message, null, image, cardImage, new Date().toISOString());
        } catch (e) {
            unlinkUpload(image); unlinkUpload(cardImage);
            if (/UNIQUE|duplicate key/i.test(e.message)) return json(res, 409, { error: 'already_posted' });
            throw e;
        }
        const saved = await listOne(id, device);
        return json(res, 201, publicWish(saved, device));
    }

    // POST /api/wishes/:id/like  (toggle)
    if (m[1] && m[2] === 'like' && req.method === 'POST') {
        if (limited(ip, 'like', 300, 3600e3)) return json(res, 429, { error: 'rate_limited' });
        const exists = await q.byId(m[1]);
        if (!exists) return json(res, 404, { error: 'not_found' });
        let liked;
        if (await q.hasLike(m[1], device)) {
            await q.delLike(m[1], device);
            liked = false;
        } else {
            await q.addLike(m[1], device);
            liked = true;
        }
        const hearts = await q.heartCount(m[1]);
        return json(res, 200, { liked, hearts });
    }

    // PUT /api/wishes/:id  (admin: edit any wish; photo/card are optional)
    if (m[1] && !m[2] && req.method === 'PUT') {
        if (!admin) return json(res, 403, { error: 'forbidden' });
        const cur = await q.byId(m[1]);
        if (!cur) return json(res, 404, { error: 'not_found' });
        const b = await readJson(req);
        const f = validatedFields(b, cur);
        let image = cur.image, cardImage = cur.card_image;
        const newPhoto = b.image ? saveJpeg(jpegFrom(b.image, 'image_invalid'), cur.id, 'photo') : null;
        const newCard = b.cardImage ? saveJpeg(jpegFrom(b.cardImage, 'card_invalid'), cur.id, 'card') : null;
        if (newPhoto) { unlinkUpload(image); image = newPhoto; }
        if (newCard) { unlinkUpload(cardImage); cardImage = newCard; }
        await q.update(f.name, f.role, f.campus, f.country, f.city, f.message, image, cardImage, cur.id);
        const updated = await listOne(cur.id, device);
        return json(res, 200, publicWish(updated, device));
    }

    // DELETE /api/wishes/:id  (admin: removes the wish for good, including its files)
    if (m[1] && !m[2] && req.method === 'DELETE') {
        if (!admin) return json(res, 403, { error: 'forbidden' });
        const cur = await q.byId(m[1]);
        if (!cur) return json(res, 404, { error: 'not_found' });
        await q.removeLikes(cur.id);
        await q.removeSeed(cur.id);
        await q.remove(cur.id);
        unlinkUpload(cur.image);
        unlinkUpload(cur.card_image);
        return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: 'method_not_allowed' });
}

/* ---------- share page: /w/:id carries Open Graph tags so Facebook shows the wish card ---------- */
async function sharePage(req, res, id) {
    const r = await q.byId(id);
    if (!r) { res.writeHead(302, { Location: '/index.html' }); return res.end(); }
    const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0];
    const base = PUBLIC_URL || `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    const img = base + (r.card_image || r.image || `/images/photos/${r.theme || 'p01'}.jpg`);
    const title = `Lời chúc của ${r.name} – Greenwich Wishes`;
    const target = `/index.html#wish=${encodeURIComponent(r.id)}`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
    res.end(`<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta property="og:type" content="article"><meta property="og:site_name" content="Greenwich Wishes – Đại học Greenwich (Việt Nam)">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(r.message)}">
<meta property="og:image" content="${esc(img)}"><meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1000"><meta property="og:image:height" content="1000">
<meta property="og:url" content="${esc(base + '/w/' + r.id)}"><meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${esc(target)}"></head>
<body><script>location.replace(${JSON.stringify(target).replace(/</g, '\\u003c')})</script><a href="${esc(target)}">${esc(title)}</a></body></html>`);
}

/* ---------- static files ---------- */
function serveFile(res, file, cache) {
    fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
        res.writeHead(200, {
            'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size,
            'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff'
        });
        fs.createReadStream(file).pipe(res);
    });
}

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url.replace(/^\/{2,}/, '/'), 'http://x');
        let p;
        try { p = decodeURIComponent(url.pathname); } catch (e) { res.writeHead(400, { 'Content-Type': 'text/plain' }); return res.end('Bad request'); }
        if (p.startsWith('/api/')) return await api(req, res, url);
        const w = p.match(/^\/w\/([\w-]+)$/);
        if (w) return await sharePage(req, res, w[1]);
        if (p === '/') p = '/index.html';
        const up = p.match(/^\/uploads\/([\w-]+\.jpg)$/);
        if (up) return serveFile(res, path.join(UPLOADS, up[1]), 'public, max-age=31536000, immutable');
        if (PUBLIC_FILES.test(p) && !p.includes('..')) return serveFile(res, path.join(ROOT, p), 'no-cache');
        res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found');
    } catch (e) {
        if (!res.headersSent) json(res, e.status || 500, e.body || { error: 'server_error' });
        if (!e.status) console.error(e);
    }
});

async function start() {
    await initDb();
    server.listen(PORT, () => console.log(`Greenwich Wishes on http://localhost:${PORT}  (PostgreSQL storage)`));
}

start().catch(err => {
    console.error('Fatal startup error:', err);
    process.exit(1);
});
