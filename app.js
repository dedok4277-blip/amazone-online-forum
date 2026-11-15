require('dotenv').config();
const express        = require('express');
const ejsLayouts     = require('express-ejs-layouts');
const session        = require('express-session');
const methodOverride = require('method-override');
const compression    = require('compression');
const path           = require('path');
const { testConnection, getPool } = require('./db/database');
const { createSchema }   = require('./db/schema');
const MySQLStore = require('express-mysql-session')(session);
const { getRoleInfo, ROLE_LABELS } = require('./middleware/auth');

const authRoutes   = require('./routes/auth');
const forumRoutes  = require('./routes/forum');
const threadRoutes = require('./routes/thread');
const postRoutes   = require('./routes/post');
const adminRoutes  = require('./routes/admin');
const userRoutes   = require('./routes/user');

const app  = express();
const PORT = process.env.PORT || 3000;

// Доверять proxy (нужно для Render/Heroku)
app.set('trust proxy', 1);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(ejsLayouts);
app.set('layout', 'layout');

// Gzip
app.use(compression());

// Static
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d', etag: true, lastModified: true,
}));

// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Method override
app.use(methodOverride('_method'));

// Session
const sessionStore = new MySQLStore({
  expiration:          7 * 24 * 60 * 60 * 1000,
  createDatabaseTable: true,
  schema: {
    tableName:    'sessions',
    columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' },
  },
}, getPool());

app.use(session({
  secret:            process.env.SESSION_SECRET || 'secret',
  resave:            false,
  saveUninitialized: false,
  store:             sessionStore,
  cookie: {
    maxAge:   7 * 24 * 60 * 60 * 1000,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

// Inject globals into every template
app.use((req, res, next) => {
  const user = req.session.user || null;

  // Если пользователь залогинен — добавляем roleInfo и perms прямо в объект
  if (user) {
    const info = getRoleInfo(user.role);
    user.roleLabel = info.label;
    user.roleClass = info.class;
    user.roleRank  = info.rank;
    user.perms     = info.perms;
  }

  res.locals.currentUser = user;
  res.locals.title       = 'Amazone Online';
  res.locals.success     = req.session.success || null;
  res.locals.error       = req.session.error   || null;
  res.locals.ROLE_LABELS = ROLE_LABELS;
  res.locals.getRoleInfo = getRoleInfo;

  delete req.session.success;
  delete req.session.error;
  next();
});

// Routes
app.use('/',       forumRoutes);
app.use('/auth',   authRoutes);
app.use('/thread', threadRoutes);
app.use('/post',   postRoutes);
app.use('/admin',  adminRoutes);
app.use('/user',   userRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('error', { code: 404, message: 'Страница не найдена' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { code: 500, message: err.message || 'Внутренняя ошибка сервера' });
});

// Boot
(async () => {
  await testConnection();
  await createSchema();
  app.listen(PORT, () => console.log(`Forum running → http://localhost:${PORT}`));
})();
