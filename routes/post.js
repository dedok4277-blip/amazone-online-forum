const express = require('express');
const { get, run } = require('../db/database');
const { requireLogin, requireModerator } = require('../middleware/auth');
const { cacheInvalidate } = require('../db/cache');
const router  = express.Router();

// POST /post/reply/:threadId
router.post('/reply/:threadId', requireLogin, async (req, res) => {
  const { content } = req.body;
  const thread = await get('SELECT * FROM threads WHERE id = ?', [req.params.threadId]);
  if (!thread) return res.status(404).render('error', { code: 404, message: 'Тред не найден' });
  if (thread.is_locked && req.session.user.role === 'member') {
    req.session.error = 'Тред закрыт для ответов';
    return res.redirect(`/thread/${thread.id}`);
  }
  if (!content || !content.trim()) {
    req.session.error = 'Сообщение не может быть пустым';
    return res.redirect(`/thread/${thread.id}`);
  }

  const userId = req.session.user.id;
  const pRes   = await run('INSERT INTO posts (thread_id, user_id, content) VALUES (?, ?, ?)', [thread.id, userId, content.trim()]);
  const postId = pRes.insertId;

  await run('UPDATE threads SET reply_count = reply_count + 1, last_post_id = ? WHERE id = ?', [postId, thread.id]);
  await run('UPDATE forums  SET post_count  = post_count  + 1, last_post_id = ? WHERE id = ?', [postId, thread.forum_id]);
  await run('UPDATE users SET post_count = post_count + 1 WHERE id = ?', [userId]);

  cacheInvalidate('home:');
  cacheInvalidate(`forum:${thread.forum_id}:`);

  // redirect to last page
  const total = await get('SELECT COUNT(*) as c FROM posts WHERE thread_id = ? AND is_deleted = 0', [thread.id]);
  const page  = Math.ceil(total.c / 15);
  res.redirect(`/thread/${thread.id}?page=${page}#post-${postId}`);
});

// POST /post/:id/like
router.post('/:id/like', requireLogin, async (req, res) => {
  const post = await get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!post) return res.json({ error: 'not found' });

  const userId  = req.session.user.id;
  const existing = await get('SELECT id FROM reactions WHERE post_id = ? AND user_id = ?', [post.id, userId]);
  if (existing) {
    await run('DELETE FROM reactions WHERE post_id = ? AND user_id = ?', [post.id, userId]);
  } else {
    await run('INSERT INTO reactions (post_id, user_id, type) VALUES (?, ?, ?)', [post.id, userId, 'like']);
  }
  const count = await get('SELECT COUNT(*) as c FROM reactions WHERE post_id = ?', [post.id]);
  res.json({ liked: !existing, count: count.c });
});

// GET /post/:id/edit
router.get('/:id/edit', requireLogin, async (req, res) => {
  const post = await get('SELECT p.*, t.forum_id FROM posts p JOIN threads t ON t.id = p.thread_id WHERE p.id = ?', [req.params.id]);
  if (!post) return res.status(404).render('error', { code: 404, message: 'Пост не найден' });
  const user = req.session.user;
  if (post.user_id !== user.id && user.role === 'member') {
    return res.status(403).render('error', { code: 403, message: 'Нет доступа' });
  }
  res.render('post/edit', { title: 'Редактировать пост', post });
});

// POST /post/:id/edit
router.post('/:id/edit', requireLogin, async (req, res) => {
  const { content } = req.body;
  const post = await get('SELECT p.*, t.id AS thread_id FROM posts p JOIN threads t ON t.id = p.thread_id WHERE p.id = ?', [req.params.id]);
  if (!post) return res.status(404).render('error', { code: 404, message: 'Пост не найден' });
  const user = req.session.user;
  if (post.user_id !== user.id && user.role === 'member') {
    return res.status(403).render('error', { code: 403, message: 'Нет доступа' });
  }
  await run('UPDATE posts SET content = ?, updated_at = NOW() WHERE id = ?', [content.trim(), post.id]);
  res.redirect(`/thread/${post.thread_id}`);
});

// POST /post/:id/delete
router.post('/:id/delete', requireLogin, async (req, res) => {
  const post = await get('SELECT p.*, t.forum_id FROM posts p JOIN threads t ON t.id = p.thread_id WHERE p.id = ?', [req.params.id]);
  if (!post) return res.status(404).render('error', { code: 404, message: 'Пост не найден' });
  const user = req.session.user;
  if (post.user_id !== user.id && user.role === 'member') {
    return res.status(403).render('error', { code: 403, message: 'Нет доступа' });
  }
  await run('UPDATE posts SET is_deleted = 1 WHERE id = ?', [post.id]);
  await run('UPDATE threads SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = ?', [post.thread_id]);
  res.redirect(`/thread/${post.thread_id}`);
});

module.exports = router;
