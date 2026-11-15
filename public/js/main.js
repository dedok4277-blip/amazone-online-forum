// ===== DROPDOWNS =====
document.querySelectorAll('.nav-item').forEach(item => {
  const trigger = item.querySelector('.nav-link, .user-avatar-btn');
  const menu    = item.querySelector('.dropdown, .user-popup');
  if (!trigger || !menu) return;

  let closeTimer;

  const open  = () => { clearTimeout(closeTimer); item.classList.add('open'); };
  const close = () => { closeTimer = setTimeout(() => item.classList.remove('open'), 120); };

  trigger.addEventListener('mouseenter', open);
  item.addEventListener('mouseleave', close);
  menu.addEventListener('mouseenter', () => clearTimeout(closeTimer));
  menu.addEventListener('mouseleave', close);

  // Also toggle on click (mobile)
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    item.classList.toggle('open');
  });
});

// Close dropdowns when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.nav-item')) {
    document.querySelectorAll('.nav-item.open').forEach(el => el.classList.remove('open'));
  }
});

// ===== LIKE BUTTONS =====
document.querySelectorAll('.like-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const postId = btn.dataset.postId;
    try {
      const res  = await fetch(`/post/${postId}/like`, { method: 'POST' });
      const data = await res.json();
      btn.querySelector('.like-count').textContent = data.count;
      btn.classList.toggle('liked', data.liked);
    } catch (e) { console.error(e); }
  });
});

// ===== QUOTE BUTTON =====
document.querySelectorAll('.quote-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    const username = btn.dataset.username;
    const content  = btn.dataset.content;
    const textarea = document.getElementById('reply-content');
    if (!textarea) return;
    textarea.value = `[quote=${username}]\n${content}\n[/quote]\n\n` + textarea.value;
    textarea.focus();
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

// ===== EDITOR TOOLBAR (basic) =====
const toolbar = document.querySelector('.editor-toolbar');
const area    = document.getElementById('reply-content');
if (toolbar && area) {
  const wrap = (before, after) => {
    const s = area.selectionStart, e = area.selectionEnd;
    const sel = area.value.substring(s, e) || 'текст';
    area.value = area.value.substring(0, s) + before + sel + after + area.value.substring(e);
    area.focus();
  };
  toolbar.querySelectorAll('button[title]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const t = btn.getAttribute('title');
      if (t === 'Жирный')       wrap('[b]', '[/b]');
      if (t === 'Курсив')       wrap('[i]', '[/i]');
      if (t === 'Подчёркнутый') wrap('[u]', '[/u]');
      if (t === 'Ссылка')       wrap('[url]', '[/url]');
    });
  });
}

// ===== AUTO-DISMISS ALERTS =====
document.querySelectorAll('.alert').forEach(el => {
  setTimeout(() => {
    el.style.transition = 'opacity .4s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }, 4000);
});

// ===== SCROLL REVEAL =====
(function () {
  const els = document.querySelectorAll(
    '.category-block, .thread-row, .post-card, .sidebar-box, .stat-card, .popular-item, .admin-form-box'
  );
  els.forEach(el => el.classList.add('reveal'));

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (!entry.isIntersecting) return;
      // small extra stagger based on DOM index among siblings
      const siblings = [...(entry.target.parentElement?.children || [])];
      const idx = siblings.indexOf(entry.target);
      const delay = Math.min(idx * 60, 300);
      setTimeout(() => entry.target.classList.add('visible'), delay);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.07 });

  els.forEach(el => io.observe(el));
})();

// ===== ANIMATED STAT COUNTERS (admin) =====
(function () {
  const counters = document.querySelectorAll('.stat-num');
  if (!counters.length) return;

  const run = (el) => {
    const target = parseInt(el.textContent.replace(/\D/g, ''), 10);
    if (isNaN(target) || target === 0) return;
    const dur = 1000, fps = 16;
    const steps = Math.ceil(dur / fps);
    let cur = 0;
    const timer = setInterval(() => {
      cur += target / steps;
      if (cur >= target) { el.textContent = target.toLocaleString('ru'); clearInterval(timer); }
      else el.textContent = Math.floor(cur).toLocaleString('ru');
    }, fps);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.5 });
  counters.forEach(el => io.observe(el));
})();

// ===== ALERT PROGRESS BAR =====
(function () {
  document.querySelectorAll('.alert').forEach((el, i) => {
    el.style.animationDelay = (i * 0.09) + 's';
    const bar = document.createElement('div');
    Object.assign(bar.style, {
      position: 'absolute', bottom: '0', left: '0',
      height: '2px', width: '100%',
      background: 'currentColor', opacity: '.5',
      transformOrigin: 'left',
      transition: 'transform 3.6s linear',
      borderRadius: '0 0 var(--radius) var(--radius)'
    });
    el.appendChild(bar);
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transform = 'scaleX(0)'; }));
  });
})();

// ===== RIPPLE EFFECT =====
(function () {
  if (!document.getElementById('ripple-style')) {
    const s = document.createElement('style');
    s.id = 'ripple-style';
    s.textContent = '@keyframes ripple-expand { to { transform:scale(1); opacity:0; } }';
    document.head.appendChild(s);
  }

  document.querySelectorAll('.btn-primary, .btn-secondary, .btn-nav-reg').forEach(btn => {
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.addEventListener('click', e => {
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 1.8;
      const sp = document.createElement('span');
      Object.assign(sp.style, {
        position: 'absolute',
        width: size + 'px', height: size + 'px',
        left: (e.clientX - r.left - size / 2) + 'px',
        top:  (e.clientY - r.top  - size / 2) + 'px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,.2)',
        transform: 'scale(0)',
        animation: 'ripple-expand .55s ease forwards',
        pointerEvents: 'none'
      });
      btn.appendChild(sp);
      sp.addEventListener('animationend', () => sp.remove());
    });
  });
})();

// ===== COUNT POP =====
(function () {
  document.querySelectorAll('.forum-count .num, .thread-counts .num').forEach(el => {
    Object.assign(el.style, { transition: 'transform .22s cubic-bezier(.22,1,.36,1), color .22s' });
    el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.3)'; el.style.color = 'var(--accent)'; });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; el.style.color = ''; });
  });
})();

// ===== HEADER SHADOW ON SCROLL =====
(function () {
  const h = document.querySelector('.site-header');
  if (!h) return;
  window.addEventListener('scroll', () => {
    h.style.boxShadow = window.scrollY > 8 ? '0 4px 30px rgba(0,0,0,.8), 0 0 0 1px rgba(232,160,0,.12)' : '';
  }, { passive: true });
})();
