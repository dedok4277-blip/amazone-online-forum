require('dotenv').config();
const bcrypt = require('bcryptjs');
const { run, get } = require('../db/database');

async function seed() {
  console.log('Seeding...');

  // Admin user
  const existing = await get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!existing) {
    const hash = await bcrypt.hash('admin123', 12);
    await run('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      ['admin', 'admin@forum.local', hash, 'admin']);
    console.log('Admin created: admin / admin123');
  }

  // Demo user
  const demoExists = await get('SELECT id FROM users WHERE username = ?', ['demo']);
  if (!demoExists) {
    const hash = await bcrypt.hash('demo123', 12);
    await run('INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      ['demo', 'demo@forum.local', hash, 'member']);
    console.log('Demo user created: demo / demo123');
  }

  // Categories
  const catExists = await get('SELECT id FROM categories LIMIT 1');
  if (!catExists) {
    await run('INSERT INTO categories (name, description, display_order) VALUES (?, ?, ?)',
      ['Общее', 'Общие обсуждения', 1]);
    await run('INSERT INTO categories (name, description, display_order) VALUES (?, ?, ?)',
      ['Поддержка', 'Вопросы и ответы', 2]);
    await run('INSERT INTO categories (name, description, display_order) VALUES (?, ?, ?)',
      ['Флуд', 'Флудилка и оффтоп', 3]);

    const cat1 = await get('SELECT id FROM categories WHERE display_order = 1');
    const cat2 = await get('SELECT id FROM categories WHERE display_order = 2');
    const cat3 = await get('SELECT id FROM categories WHERE display_order = 3');

    await run('INSERT INTO forums (category_id, name, description, display_order) VALUES (?, ?, ?, ?)',
      [cat1.id, 'Новости', 'Новости форума', 1]);
    await run('INSERT INTO forums (category_id, name, description, display_order) VALUES (?, ?, ?, ?)',
      [cat1.id, 'Знакомства', 'Расскажите о себе', 2]);
    await run('INSERT INTO forums (category_id, name, description, display_order) VALUES (?, ?, ?, ?)',
      [cat2.id, 'Помощь', 'Задайте вопрос', 1]);
    await run('INSERT INTO forums (category_id, name, description, display_order) VALUES (?, ?, ?, ?)',
      [cat3.id, 'Флуд', 'Общайтесь свободно', 1]);

    // Sample thread
    const adminUser = await get('SELECT id FROM users WHERE username = ?', ['admin']);
    const forum1    = await get('SELECT id FROM forums WHERE name = ?', ['Новости']);

    const tRes = await run(
      'INSERT INTO threads (forum_id, user_id, title, is_pinned) VALUES (?, ?, ?, ?)',
      [forum1.id, adminUser.id, 'Добро пожаловать на NodeForum!', 1]
    );
    const threadId = tRes.insertId;

    const pRes = await run(
      'INSERT INTO posts (thread_id, user_id, content) VALUES (?, ?, ?)',
      [threadId, adminUser.id, 'Привет всем! Это NodeForum — современный форум на Node.js.\n\nРегистрируйтесь, создавайте темы и общайтесь!\n\nАдмин панель: /admin']
    );
    const postId = pRes.insertId;

    await run('UPDATE threads SET last_post_id = ?, reply_count = 0 WHERE id = ?', [postId, threadId]);
    await run('UPDATE forums SET thread_count = 1, post_count = 1, last_post_id = ? WHERE id = ?', [postId, forum1.id]);
    await run('UPDATE users SET post_count = 1 WHERE id = ?', [adminUser.id]);

    console.log('Sample data created');
  }

  console.log('Seed done ✓');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
