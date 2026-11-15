const express = require('express');
const { get, all, run } = require('../db/database');
const { requireAdmin, requirePermission, ROLE_LABELS, ROLE_RANK, PERMISSIONS } = require('../middleware/auth');
const router = express.Router();

router.use(requireAdmin);

// GET /admin
router.get('/', async (req, res) => {
  const stats = await get(`
    SELECT
      (SELECT COUNT(*) FROM users)      AS total_users,
      (SELECT COUNT(*) FROM threads)    AS total_threads,
      (SELECT COUNT(*) FROM posts)      AS total_posts,
      (SELECT COUNT(*) FROM categories) AS total_categories
  `);
  res.render('admin/index', { title: 'Админ панель', stats });
});

// --- Categories ---
router.get('/categories', async (req, res) => {
  const categories = await all('SELECT * FROM categories ORDER BY display_order ASC');
  res.render('admin/categories', { title: 'Категории', categories });
});

router.post('/categories/create', async (req, res) => {
  const { name, description, display_order } = req.body;
  await run('INSERT INTO categories (name, description, display_order) VALUES (?, ?, ?)',
    [name.trim(), description || '', parseInt(display_order) || 0]);
  req.session.success = 'Категория создана';
  res.redirect('/admin/categories');
});

router.post('/categories/:id/delete', async (req, res) => {
  await run('DELETE FROM categories WHERE id = ?', [req.params.id]);
  req.session.success = 'Категория удалена';
  res.redirect('/admin/categories');
});

router.post('/categories/:id/edit', async (req, res) => {
  const { name, description, display_order } = req.body;
  await run('UPDATE categories SET name = ?, description = ?, display_order = ? WHERE id = ?',
    [name.trim(), description || '', parseInt(display_order) || 0, req.params.id]);
  req.session.success = 'Категория обновлена';
  res.redirect('/admin/categories');
});

// --- Forums ---
router.get('/forums', async (req, res) => {
  const forums = await all(`
    SELECT f.*, c.name AS category_name
    FROM forums f JOIN categories c ON c.id = f.category_id
    ORDER BY c.display_order, f.display_order
  `);
  const categories = await all('SELECT * FROM categories ORDER BY display_order');
  res.render('admin/forums', { title: 'Форумы', forums, categories });
});

router.post('/forums/create', async (req, res) => {
  const { category_id, name, description, display_order, parent_forum_id } = req.body;
  await run(
    'INSERT INTO forums (category_id, parent_forum_id, name, description, display_order) VALUES (?, ?, ?, ?, ?)',
    [category_id, parent_forum_id || null, name.trim(), description || '', parseInt(display_order) || 0]
  );
  req.session.success = 'Форум создан';
  // Если создан из страницы форума — вернуть туда
  if (parent_forum_id) return res.redirect(`/forum/${parent_forum_id}`);
  res.redirect('/admin/forums');
});

router.post('/forums/:id/delete', async (req, res) => {
  await run('DELETE FROM forums WHERE id = ?', [req.params.id]);
  req.session.success = 'Форум удалён';
  res.redirect('/admin/forums');
});

router.post('/forums/:id/edit', async (req, res) => {
  const { name, description, display_order, category_id } = req.body;
  await run('UPDATE forums SET name = ?, description = ?, display_order = ?, category_id = ? WHERE id = ?',
    [name.trim(), description || '', parseInt(display_order) || 0, category_id, req.params.id]);
  req.session.success = 'Форум обновлён';
  res.redirect('/admin/forums');
});

// --- Users ---
router.get('/users', async (req, res) => {
  const users = await all('SELECT id, username, email, role, post_count, is_banned, created_at FROM users ORDER BY id DESC');

  // Список ролей которые может выдавать текущий пользователь
  const myRole = req.session.user.role;
  const canAssign = PERMISSIONS.canAssignRoles(myRole);
  const canBan    = PERMISSIONS.canBanUsers(myRole);
  const canDelete = PERMISSIONS.canDeleteUsers(myRole);

  // Роли доступные для выдачи (нельзя выдать роль выше своей)
  const myRank = ROLE_RANK[myRole] || 9;
  const assignableRoles = Object.entries(ROLE_LABELS)
    .filter(([key]) => ROLE_RANK[key] >= myRank || canAssign)
    .map(([key, label]) => ({ key, label }));

  res.render('admin/users', {
    title: 'Пользователи',
    users,
    canAssign,
    canBan,
    canDelete,
    assignableRoles,
    ROLE_LABELS,
  });
});

// Бан / разбан
router.post('/users/:id/ban', async (req, res) => {
  const myRole = req.session.user.role;
  if (!PERMISSIONS.canBanUsers(myRole)) {
    req.session.error = 'Недостаточно прав';
    return res.redirect('/admin/users');
  }
  const user = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.redirect('/admin/users');
  // Нельзя банить того кто выше тебя
  if ((ROLE_RANK[user.role] || 9) < (ROLE_RANK[myRole] || 9)) {
    req.session.error = 'Нельзя заблокировать пользователя с более высокой ролью';
    return res.redirect('/admin/users');
  }
  await run('UPDATE users SET is_banned = ? WHERE id = ?', [user.is_banned ? 0 : 1, user.id]);
  req.session.success = user.is_banned ? 'Пользователь разблокирован' : 'Пользователь заблокирован';
  res.redirect('/admin/users');
});

// Выдача роли
router.post('/users/:id/role', async (req, res) => {
  const myRole = req.session.user.role;
  if (!PERMISSIONS.canAssignRoles(myRole)) {
    req.session.error = 'Недостаточно прав для выдачи ролей';
    return res.redirect('/admin/users');
  }
  const { role } = req.body;
  if (!ROLE_LABELS[role]) {
    req.session.error = 'Неизвестная роль';
    return res.redirect('/admin/users');
  }
  // Нельзя выдать роль выше своей (кроме rukovoditel)
  if (myRole !== 'rukovoditel' && ROLE_RANK[role] < ROLE_RANK[myRole]) {
    req.session.error = 'Нельзя выдать роль выше своей';
    return res.redirect('/admin/users');
  }
  await run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
  req.session.success = `Роль "${ROLE_LABELS[role]}" выдана`;
  res.redirect('/admin/users');
});

// Удаление пользователя
router.post('/users/:id/delete', async (req, res) => {
  const myRole = req.session.user.role;
  if (!PERMISSIONS.canDeleteUsers(myRole)) {
    req.session.error = 'Недостаточно прав';
    return res.redirect('/admin/users');
  }
  const user = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (user && (ROLE_RANK[user.role] || 9) < (ROLE_RANK[myRole] || 9)) {
    req.session.error = 'Нельзя удалить пользователя с более высокой ролью';
    return res.redirect('/admin/users');
  }
  await run('DELETE FROM users WHERE id = ?', [req.params.id]);
  req.session.success = 'Пользователь удалён';
  res.redirect('/admin/users');
});

module.exports = router;
