require('dotenv').config();
const mysql = require('mysql2/promise');

let pool = null;

function getPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'sakura.proxy.rlwy.net',
    port:               parseInt(process.env.DB_PORT) || 51761,
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'railway',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    timezone:           '+00:00',
    connectTimeout:     30000,
    ssl:                { rejectUnauthorized: false },
    // Автоматически переподключаться при разрыве
    enableKeepAlive:    true,
    keepAliveInitialDelay: 10000,
  });

  // Перехватываем ошибки пула чтобы они не крашили процесс
  pool.on('error', (err) => {
    console.error('MySQL pool error:', err.code);
    if (err.code === 'PROTOCOL_CONNECTION_LOST' ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT') {
      pool = null; // сбросим пул — пересоздастся при след. запросе
    }
  });

  return pool;
}

// Обёртка с retry при потере соединения
async function withRetry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn(getPool());
    } catch (err) {
      const isConnErr = ['ETIMEDOUT','ECONNRESET','PROTOCOL_CONNECTION_LOST',
                         'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR'].includes(err.code);
      if (isConnErr && i < retries - 1) {
        console.warn(`DB connection lost (${err.code}), retry ${i + 1}…`);
        pool = null;
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
      } else {
        throw err;
      }
    }
  }
}

async function get(sql, params = []) {
  return withRetry(async (p) => {
    const [rows] = await p.execute(sql, params);
    return rows[0] ?? null;
  });
}

async function all(sql, params = []) {
  return withRetry(async (p) => {
    const [rows] = await p.execute(sql, params);
    return rows;
  });
}

async function run(sql, params = []) {
  return withRetry(async (p) => {
    const [result] = await p.execute(sql, params);
    return result;
  });
}

async function testConnection() {
  return withRetry(async (p) => {
    const conn = await p.getConnection();
    await conn.ping();
    conn.release();
    console.log('MySQL connected ✓');
  });
}

// Keep-alive пинг каждые 4 минуты
setInterval(async () => {
  try {
    await withRetry(async (p) => {
      const conn = await p.getConnection();
      await conn.ping();
      conn.release();
    });
  } catch (e) {
    console.warn('Keep-alive ping failed:', e.code);
    pool = null;
  }
}, 4 * 60 * 1000);

module.exports = { getPool, get, all, run, testConnection };
