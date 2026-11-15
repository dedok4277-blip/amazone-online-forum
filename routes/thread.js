const express = require('express');
const { get, all, run } = require('../db/database');
const { requireLogin, requireModerator, getRoleInfo } = require('../middleware/auth');
const { cacheInvalidate } = require('../db/cache');
const router  = express.Router();

// GET /thread/:id — просмотр треда
router.get('/:id', async (req, res) => {
  const thread = await get(`
    SELECT t.*, f.name AS forum_name, f.id AS forum_id,
           c.name AS category_name, c.id AS category_id,
           u.username, u.avatar, u.post_count, u.role, u.created_at AS user_joined
    FROM threads t
    JOIN forums f   ON f.id = t.forum_id
    JOIN categories c ON c.id = f.category_id
    JOIN users u    ON u.id = t.user_id
    WHERE t.id = ?
  `, [req.params.id]);
  if (!thread) return res.status(404).render('error', { code: 404, message: 'Тред не найден' });

  // increment views
  await run('UPDATE threads SET view_count = view_count + 1 WHERE id = ?', [req.params.id]);

  const page    = parseInt(req.query.page) || 1;
  const perPage = 15;
  const offset  = (page - 1) * perPage;

  const total = await get('SELECT COUNT(*) as c FROM posts WHERE thread_id = ? AND is_deleted = 0', [req.params.id]);
  const posts = await all(`
    SELECT p.*, u.username, u.avatar, u.role, u.post_count, u.signature, u.created_at AS user_joined,
           (SELECT COUNT(*) FROM reactions r WHERE r.post_id = p.id) AS like_count
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.thread_id = ? AND p.is_deleted = 0
    ORDER BY p.created_at ASC
    LIMIT ? OFFSET ?
  `, [req.params.id, perPage, offset]);

  // which posts current user liked
  let likedPosts = [];
  if (req.session.user) {
    const liked = await all('SELECT post_id FROM reactions WHERE user_id = ?', [req.session.user.id]);
    likedPosts  = liked.map(r => r.post_id);
  }

  // Добавляем roleLabel к каждому посту
  posts.forEach(p => {
    const info = getRoleInfo(p.role);
    p.roleLabel = info.label;
    p.roleClass = info.class;
  });

  res.render('thread', {
    title: thread.title, thread, posts, likedPosts,
    page, totalPages: Math.ceil(total.c / perPage),
  });
});

// GET /thread/new/:forumId
router.get('/new/:forumId', requireLogin, async (req, res) => {
  const forum = await get('SELECT * FROM forums WHERE id = ?', [req.params.forumId]);
  if (!forum) return res.status(404).render('error', { code: 404, message: 'Форум не найден' });
  res.render('thread/new', { title: 'Новый тред', forum });
});

// POST /thread/new/:forumId
router.post('/new/:forumId', requireLogin, async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    req.session.error = 'Заполните заголовок и текст';
    return res.redirect(`/thread/new/${req.params.forumId}`);
  }
  const forum = await get('SELECT * FROM forums WHERE id = ?', [req.params.forumId]);
  if (!forum) return res.status(404).render('error', { code: 404, message: 'Форум не найден' });

  const userId = req.session.user.id;
  const tRes = await run(
    'INSERT INTO threads (forum_id, user_id, title) VALUES (?, ?, ?)',
    [forum.id, userId, title.trim()]
  );
  const threadId = tRes.insertId;

  const pRes = await run(
    'INSERT INTO posts (thread_id, user_id, content) VALUES (?, ?, ?)',
    [threadId, userId, content.trim()]
  );
  const postId = pRes.insertId;

  await run('UPDATE threads SET last_post_id = ?, reply_count = 0 WHERE id = ?', [postId, threadId]);
  await run('UPDATE forums SET thread_count = thread_count + 1, post_count = post_count + 1, last_post_id = ? WHERE id = ?', [postId, forum.id]);
  await run('UPDATE users SET post_count = post_count + 1 WHERE id = ?', [userId]);

  cacheInvalidate('home:');
  cacheInvalidate(`forum:${forum.id}:`);

  res.redirect(`/thread/${threadId}`);
});

// POST /thread/:id/lock — модератор
router.post('/:id/lock', requireModerator, async (req, res) => {
  const thread = await get('SELECT * FROM threads WHERE id = ?', [req.params.id]);
  if (!thread) return res.status(404).render('error', { code: 404, message: 'Тред не найден' });
  await run('UPDATE threads SET is_locked = ? WHERE id = ?', [thread.is_locked ? 0 : 1, thread.id]);
  res.redirect(`/thread/${thread.id}`);
});

// POST /thread/:id/pin — модератор
router.post('/:id/pin', requireModerator, async (req, res) => {
  const thread = await get('SELECT * FROM threads WHERE id = ?', [req.params.id]);
  if (!thread) return res.status(404).render('error', { code: 404, message: 'Тред не найден' });
  await run('UPDATE threads SET is_pinned = ? WHERE id = ?', [thread.is_pinned ? 0 : 1, thread.id]);
  res.redirect(`/thread/${thread.id}`);
});

// POST /thread/:id/delete — модератор
router.post('/:id/delete', requireModerator, async (req, res) => {
  const thread = await get('SELECT * FROM threads WHERE id = ?', [req.params.id]);
  if (!thread) return res.status(404).render('error', { code: 404, message: 'Тред не найден' });
  await run('DELETE FROM threads WHERE id = ?', [thread.id]);
  await run('UPDATE forums SET thread_count = GREATEST(thread_count - 1, 0) WHERE id = ?', [thread.forum_id]);
  res.redirect(`/forum/${thread.forum_id}`);
});

module.exports = router;
