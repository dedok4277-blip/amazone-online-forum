const express = require('express');
const { get, all } = require('../db/database');
const { cacheGet, cacheSet } = require('../db/cache');
const router  = express.Router();

// GET / — главная (кэш 10 сек)
router.get('/', async (req, res) => {
  const CACHE_KEY = 'home:index';
  let payload = cacheGet(CACHE_KEY);

  if (!payload) {
    const categories = await all('SELECT * FROM categories ORDER BY display_order ASC');
    for (const cat of categories) {
      cat.forums = await all(`
        SELECT f.*,
               t.title      AS last_thread_title,
               t.id         AS last_thread_id,
               u.username   AS last_post_user,
               p.created_at AS last_post_at
        FROM forums f
        LEFT JOIN posts   p ON p.id = f.last_post_id
        LEFT JOIN threads t ON t.id = p.thread_id
        LEFT JOIN users   u ON u.id = p.user_id
        WHERE f.category_id = ?
        ORDER BY f.display_order ASC
      `, [cat.id]);
    }

    const stats = await get(`
      SELECT
        (SELECT COUNT(*) FROM users)   AS total_users,
        (SELECT COUNT(*) FROM threads) AS total_threads,
        (SELECT COUNT(*) FROM posts)   AS total_posts,
        (SELECT username FROM users ORDER BY id DESC LIMIT 1) AS newest_user
    `);

    // Popular content — топ тредов по reply_count
    const popular = await all(`
      SELECT t.id AS thread_id, t.title, t.reply_count,
             u.username, u.avatar, p.created_at
      FROM threads t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN posts p ON p.id = t.last_post_id
      ORDER BY t.reply_count DESC, t.created_at DESC
      LIMIT 6
    `);

    // Online users — последние активные за 15 мин
    const onlineUsers = await all(`
      SELECT id, username FROM users
      WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
      ORDER BY last_seen DESC LIMIT 20
    `);

    payload = { categories, stats, popular, onlineUsers };
    cacheSet(CACHE_KEY, payload, 10000);
  }

  res.render('index', { title: 'Форум', ...payload });
});

// GET /forum/:id
router.get('/forum/:id', async (req, res) => {
  const fid  = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const CACHE_KEY = `forum:${fid}:${page}`;
  let payload = cacheGet(CACHE_KEY);

  if (!payload) {
    const forum = await get(`
      SELECT f.*, c.name AS category_name
      FROM forums f JOIN categories c ON c.id = f.category_id
      WHERE f.id = ?
    `, [fid]);
    if (!forum) return res.status(404).render('error', { code: 404, message: 'Форум не найден' });

    // Подфорумы внутри этого форума
    const subforums = await all(`
      SELECT f.*,
             t.title      AS last_thread_title,
             t.id         AS last_thread_id,
             u.username   AS last_post_user,
             p.created_at AS last_post_at
      FROM forums f
      LEFT JOIN posts   p ON p.id = f.last_post_id
      LEFT JOIN threads t ON t.id = p.thread_id
      LEFT JOIN users   u ON u.id = p.user_id
      WHERE f.parent_forum_id = ?
      ORDER BY f.display_order ASC
    `, [fid]);

    const perPage = 20;
    const offset  = (page - 1) * perPage;
    const total   = await get('SELECT COUNT(*) as c FROM threads WHERE forum_id = ?', [fid]);
    const threads = await all(`
      SELECT t.*, u.username, u.avatar,
             lp.created_at AS last_post_at,
             lu.username   AS last_post_user,
             lu.id         AS last_post_user_id,
             lu.avatar     AS last_post_avatar
      FROM threads t
      JOIN users u ON u.id = t.user_id
      LEFT JOIN posts lp ON lp.id = t.last_post_id
      LEFT JOIN users lu ON lu.id = lp.user_id
      WHERE t.forum_id = ?
      ORDER BY t.is_pinned DESC, COALESCE(lp.created_at, t.created_at) DESC
      LIMIT ? OFFSET ?
    `, [fid, perPage, offset]);

    payload = { forum, subforums, threads, page, totalPages: Math.ceil(total.c / perPage) };
    cacheSet(CACHE_KEY, payload, 5000);
  }

  res.render('forum', { title: payload.forum.name, ...payload });
});

// GET /new-posts
router.get('/new-posts', async (req, res) => {
  const threads = await all(`
    SELECT t.*, u.username, f.name AS forum_name, f.id AS forum_id,
           lp.created_at AS last_post_at, lu.username AS last_post_user
    FROM threads t
    JOIN users u ON u.id = t.user_id
    JOIN forums f ON f.id = t.forum_id
    LEFT JOIN posts lp ON lp.id = t.last_post_id
    LEFT JOIN users lu ON lu.id = lp.user_id
    ORDER BY COALESCE(lp.created_at, t.created_at) DESC
    LIMIT 30
  `);
  res.render('new-posts', { title: 'Новые сообщения', threads });
});

// GET /members
router.get('/members', async (req, res) => {
  const users = await all('SELECT id, username, avatar, role, post_count, created_at FROM users ORDER BY created_at DESC LIMIT 50');
  res.render('members', { title: 'Пользователи', users });
});

// GET /search
router.get('/search', async (req, res) => {
  res.render('new-posts', { title: 'Поиск', threads: [] });
});

module.exports = router;
