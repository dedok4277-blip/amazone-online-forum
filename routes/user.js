const express  = require('express');
const bcrypt   = require('bcryptjs');
const multer   = require('multer');
const path     = require('path');
const { get, all, run } = require('../db/database');
const { requireLogin, getRoleInfo } = require('../middleware/auth');
const router   = express.Router();

const storage = multer.diskStorage({
  destination: 'public/uploads/avatars/',
  filename: (req, file, cb) => {
    cb(null, `${req.session.user.id}-${Date.now()}${path.extname(file.originalname)}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

// GET /user/:id — профиль
router.get('/:id', async (req, res) => {
  const user = await get('SELECT id, username, avatar, role, post_count, created_at, last_seen, signature FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).render('error', { code: 404, message: 'Пользователь не найден' });
  const recentPosts = await all(`
    SELECT p.id, p.content, p.created_at, t.title AS thread_title, t.id AS thread_id
    FROM posts p JOIN threads t ON t.id = p.thread_id
    WHERE p.user_id = ? AND p.is_deleted = 0
    ORDER BY p.created_at DESC LIMIT 10
  `, [user.id]);
  res.render('user/profile', { title: user.username, profile: user, recentPosts, roleInfo: getRoleInfo(user.role) });
});

// GET /user/:id/edit
router.get('/:id/edit', requireLogin, async (req, res) => {
  if (req.session.user.id != req.params.id && req.session.user.role !== 'admin') {
    return res.status(403).render('error', { code: 403, message: 'Нет доступа' });
  }
  const user = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  res.render('user/edit', { title: 'Настройки профиля', profile: user });
});

// POST /user/:id/edit
router.post('/:id/edit', requireLogin, upload.single('avatar'), async (req, res) => {
  if (req.session.user.id != req.params.id && req.session.user.role !== 'admin') {
    return res.status(403).render('error', { code: 403, message: 'Нет доступа' });
  }
  const { signature, password, password2 } = req.body;
  const updates = [];
  const values  = [];

  if (signature !== undefined) { updates.push('signature = ?'); values.push(signature.trim()); }
  if (req.file) {
    updates.push('avatar = ?');
    values.push('/uploads/avatars/' + req.file.filename);
    if (req.session.user.id == req.params.id) req.session.user.avatar = '/uploads/avatars/' + req.file.filename;
  }
  if (password && password.length >= 6 && password === password2) {
    const hash = await bcrypt.hash(password, 12);
    updates.push('password = ?');
    values.push(hash);
  }

  if (updates.length) {
    values.push(req.params.id);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
  }

  req.session.success = 'Профиль обновлён';
  res.redirect(`/user/${req.params.id}`);
});

module.exports = router;
