// =============================================
//  Иерархия ролей и права доступа
// =============================================

// Ранг: чем меньше число — тем выше роль
const ROLE_RANK = {
  rukovoditel:   1,  // Руководитель
  komanda:       2,  // Команда проекта
  spec_admin:    3,  // Спец. Администратор
  glavny_admin:  4,  // Главный Администратор
  zam_glavnogo:  5,  // Зам Главного Администратора
  starshy_admin: 6,  // Старший Администратор
  admin:         7,  // Администратор
  lider:         8,  // Лидер
  member:        9,  // Пользователь
};

// Отображаемые названия ролей
const ROLE_LABELS = {
  rukovoditel:   'Руководитель',
  komanda:       'Команда проекта',
  spec_admin:    'Спец. Администратор',
  glavny_admin:  'Главный Администратор',
  zam_glavnogo:  'Зам. Главного Администратора',
  starshy_admin: 'Старший Администратор',
  admin:         'Администратор',
  lider:         'Лидер',
  member:        'Пользователь',
};

// CSS-класс для бейджа роли
const ROLE_CLASS = {
  rukovoditel:   'role-rukovoditel',
  komanda:       'role-komanda',
  spec_admin:    'role-spec-admin',
  glavny_admin:  'role-glavny-admin',
  zam_glavnogo:  'role-zam-glavnogo',
  starshy_admin: 'role-starshy-admin',
  admin:         'role-admin',
  lider:         'role-lider',
  member:        'role-member',
};

// Права доступа для каждой роли
const PERMISSIONS = {
  // Может ли создавать посты/темы
  canPost: (role) => role !== undefined,

  // Может ли создавать темы
  canCreateThread: (role) => ROLE_RANK[role] <= 8, // все кроме member тоже могут

  // Может ли создавать категории и форумы
  canManageForums: (role) => ROLE_RANK[role] <= 8, // лидер и выше

  // Может ли закреплять/закрывать темы
  canModerateThreads: (role) => ROLE_RANK[role] <= 7, // admin и выше

  // Может ли редактировать/удалять чужие посты
  canEditPosts: (role) => ROLE_RANK[role] <= 7,

  // Может ли удалять темы
  canDeleteThreads: (role) => ROLE_RANK[role] <= 7,

  // Может ли блокировать пользователей
  canBanUsers: (role) => ROLE_RANK[role] <= 2, // только rukovoditel и komanda

  // Может ли удалять пользователей
  canDeleteUsers: (role) => ROLE_RANK[role] <= 2,

  // Может ли выдавать роли
  canAssignRoles: (role) => ROLE_RANK[role] <= 2,

  // Доступ к админ-панели (статистика, просмотр)
  canAccessAdmin: (role) => ROLE_RANK[role] <= 7,

  // Может ли управлять категориями/форумами через админку
  canAdminForums: (role) => ROLE_RANK[role] <= 8,
};

// Возвращает объект с правами для шаблонов (используется в locals)
function getRoleInfo(role) {
  return {
    label:  ROLE_LABELS[role] || 'Пользователь',
    class:  ROLE_CLASS[role]  || 'role-member',
    rank:   ROLE_RANK[role]   || 9,
    perms:  {
      canPost:            PERMISSIONS.canPost(role),
      canCreateThread:    PERMISSIONS.canCreateThread(role),
      canManageForums:    PERMISSIONS.canManageForums(role),
      canModerateThreads: PERMISSIONS.canModerateThreads(role),
      canEditPosts:       PERMISSIONS.canEditPosts(role),
      canDeleteThreads:   PERMISSIONS.canDeleteThreads(role),
      canBanUsers:        PERMISSIONS.canBanUsers(role),
      canDeleteUsers:     PERMISSIONS.canDeleteUsers(role),
      canAssignRoles:     PERMISSIONS.canAssignRoles(role),
      canAccessAdmin:     PERMISSIONS.canAccessAdmin(role),
      canAdminForums:     PERMISSIONS.canAdminForums(role),
    },
  };
}

// ---- Middleware ----

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.session.error = 'Войдите в аккаунт';
    return res.redirect('/auth/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  const role = req.session.user && req.session.user.role;
  if (!role || !PERMISSIONS.canAccessAdmin(role)) {
    return res.status(403).render('error', { code: 403, message: 'Доступ запрещён' });
  }
  next();
}

function requireModerator(req, res, next) {
  const role = req.session.user && req.session.user.role;
  if (!role || !PERMISSIONS.canModerateThreads(role)) {
    return res.status(403).render('error', { code: 403, message: 'Доступ запрещён' });
  }
  next();
}

function requirePermission(permName) {
  return (req, res, next) => {
    const role = req.session.user && req.session.user.role;
    if (!role || !PERMISSIONS[permName] || !PERMISSIONS[permName](role)) {
      return res.status(403).render('error', { code: 403, message: 'Недостаточно прав' });
    }
    next();
  };
}

module.exports = {
  requireLogin,
  requireAdmin,
  requireModerator,
  requirePermission,
  ROLE_RANK,
  ROLE_LABELS,
  ROLE_CLASS,
  PERMISSIONS,
  getRoleInfo,
};
