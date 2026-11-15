const { run } = require('./database');

// Иерархия ролей (от высшей к низшей)
const ROLES = [
  'rukovoditel',      // Руководитель       — все права
  'komanda',          // Команда проекта     — все права
  'spec_admin',       // Спец. Администратор — всё кроме ролей/бана/удаления
  'glavny_admin',     // Главный Администратор
  'zam_glavnogo',     // Зам Главного Администратора
  'starshy_admin',    // Старший Администратор
  'admin',            // Администратор
  'lider',            // Лидер               — создавать темы и категории
  'member',           // Пользователь        — обычные права
];

async function createSchema() {
  // Users
  await run(`CREATE TABLE IF NOT EXISTS users (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50)  UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    avatar      VARCHAR(255) DEFAULT NULL,
    signature   TEXT,
    role        VARCHAR(30) DEFAULT 'member',
    post_count  INT DEFAULT 0,
    is_banned   TINYINT(1) DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen   DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Migrate: change role column from ENUM to VARCHAR if needed
  await run(`ALTER TABLE users MODIFY COLUMN role VARCHAR(30) DEFAULT 'member'`).catch(() => {});

  // Categories
  await run(`CREATE TABLE IF NOT EXISTS categories (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    description   TEXT,
    display_order INT DEFAULT 0
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Forums
  await run(`CREATE TABLE IF NOT EXISTS forums (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    category_id     INT NOT NULL,
    parent_forum_id INT DEFAULT NULL,
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    display_order   INT DEFAULT 0,
    thread_count    INT DEFAULT 0,
    post_count      INT DEFAULT 0,
    last_post_id    INT DEFAULT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Migrate: add parent_forum_id if missing
  await run(`ALTER TABLE forums ADD COLUMN parent_forum_id INT DEFAULT NULL`).catch(() => {});

  // Threads
  await run(`CREATE TABLE IF NOT EXISTS threads (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    forum_id     INT NOT NULL,
    user_id      INT NOT NULL,
    title        VARCHAR(255) NOT NULL,
    is_pinned    TINYINT(1) DEFAULT 0,
    is_locked    TINYINT(1) DEFAULT 0,
    view_count   INT DEFAULT 0,
    reply_count  INT DEFAULT 0,
    last_post_id INT DEFAULT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (forum_id) REFERENCES forums(id)  ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(id)   ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Posts
  await run(`CREATE TABLE IF NOT EXISTS posts (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    thread_id  INT NOT NULL,
    user_id    INT NOT NULL,
    content    TEXT NOT NULL,
    is_deleted TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Reactions
  await run(`CREATE TABLE IF NOT EXISTS reactions (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    post_id    INT NOT NULL,
    user_id    INT NOT NULL,
    type       VARCHAR(20) DEFAULT 'like',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_reaction (post_id, user_id),
    FOREIGN KEY (post_id)  REFERENCES posts(id)  ON DELETE CASCADE,
    FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Conversations
  await run(`CREATE TABLE IF NOT EXISTS conversations (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    subject    VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id INT NOT NULL,
    user_id         INT NOT NULL,
    is_read         TINYINT(1) DEFAULT 0,
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await run(`CREATE TABLE IF NOT EXISTS messages (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    user_id         INT NOT NULL,
    content         TEXT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)         REFERENCES users(id)         ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Notifications
  await run(`CREATE TABLE IF NOT EXISTS notifications (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    type       VARCHAR(50) NOT NULL,
    message    TEXT NOT NULL,
    link       VARCHAR(255) DEFAULT '',
    is_read    TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  console.log('Schema ready ✓');
}

module.exports = { createSchema, ROLES };
