const express  = require('express');
const bcrypt   = require('bcryptjs');
const { get, run } = require('../db/database');
const router   = express.Router();

// GET /auth/login
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login', { title: 'Вход' });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      req.session.error = 'Неверный логин или пароль';
      return res.redirect('/auth/login');
    }
    if (user.is_banned) {
      req.session.error = 'Ваш аккаунт заблокирован';
      return res.redirect('/auth/login');
    }
    await run('UPDATE users SET last_seen = NOW() WHERE id = ?', [user.id]);
    req.session.user = { id: user.id, username: user.username, role: user.role, avatar: user.avatar };
    res.redirect('/');
  } catch (e) {
    console.error(e);
    req.session.error = 'Ошибка входа';
    res.redirect('/auth/login');
  }
});

// GET /auth/register
router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/register', { title: 'Регистрация' });
});

// POST /auth/register
router.post('/register', async (req, res) => {
  const { username, email, password, password2 } = req.body;
  if (!username || !email || !password) {
    req.session.error = 'Заполните все поля';
    return res.redirect('/auth/register');
  }
  if (password !== password2) {
    req.session.error = 'Пароли не совпадают';
    return res.redirect('/auth/register');
  }
  if (password.length < 6) {
    req.session.error = 'Пароль минимум 6 символов';
    return res.redirect('/auth/register');
  }
  try {
    const existing = await get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      req.session.error = 'Логин или email уже занят';
      return res.redirect('/auth/register');
    }
    const hash = await bcrypt.hash(password, 12);
    // First user becomes admin
    const count = await get('SELECT COUNT(*) as c FROM users');
    const role  = count.c === 0 ? 'admin' : 'member';
    await run('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)', [username, email, hash, role]);
    req.session.success = 'Регистрация успешна! Войдите в аккаунт.';
    res.redirect('/auth/login');
  } catch (e) {
    console.error(e);
    req.session.error = 'Ошибка регистрации';
    res.redirect('/auth/register');
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
