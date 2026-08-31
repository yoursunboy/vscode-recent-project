/* global acquireVsCodeApi */
// @ts-nocheck

(function () {
  const vscode = acquireVsCodeApi();
  const listEl = document.getElementById('list');
  const searchEl = document.getElementById('search');

  let entries = [];
  let lang = '';
  const strings = {
    zh: {
      empty: '暂无最近项目',
      editNote: '编辑备注',
      remove: '从列表移除',
      pin: '收藏',
      unpin: '取消收藏',
      justNow: '刚刚',
      minutesAgo: (n) => `${n} 分钟前`,
      hoursAgo: (n) => `${n} 小时前`,
      yesterday: '昨天',
      daysAgo: (n) => `${n} 天前`,
    },
    en: {
      empty: 'No recent projects',
      editNote: 'Edit note',
      remove: 'Remove from list',
      pin: 'Favorite',
      unpin: 'Unfavorite',
      justNow: 'just now',
      minutesAgo: (n) => `${n} min ago`,
      hoursAgo: (n) => `${n} hr ago`,
      yesterday: 'yesterday',
      daysAgo: (n) => `${n} days ago`,
    },
  };
  const t = () => (lang.startsWith('zh') ? strings.zh : strings.en);

  // 内联 SVG 图标，避免外部资源
  const ICONS = {
    star: '<svg width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" d="M9.595 6.25244L8 1L6.40498 6.25244L0.852188 6.99956L5.0438 10.3845L3.79533 15.8574L8 13.0327L12.2047 15.8574L10.9562 10.3845L15.1478 6.99956L9.595 6.25244Z"/></svg>',
    edit: '<svg width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" d="M11.8 1.2 14.8 4.2 6 13H3v-3l8.8-8.8zM1 16h14v-1H1z"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" d="M6 2h4l.5 1H14v1H2V3h3.5L6 2zM3.5 6h9l-.7 8.3a1 1 0 0 1-1 .7h-5.6a1 1 0 0 1-1-.7L3.5 6z"/></svg>',
  };

  // 名称最多显示 25 个字符，超出截断，完整名称放 title 提示
  function cap(str, n) {
    const s = str || '';
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  function formatTime(ts) {
    if (!ts || ts <= 0) return '';
    const s = t();
    const diff = Date.now() - ts;
    const MIN = 60 * 1000;
    const HOUR = 60 * MIN;
    const DAY = 24 * HOUR;
    if (diff < MIN) return s.justNow;
    if (diff < HOUR) return s.minutesAgo(Math.floor(diff / MIN));
    if (diff < DAY) return s.hoursAgo(Math.floor(diff / HOUR));
    if (diff < 2 * DAY) return s.yesterday;
    if (diff < 30 * DAY) return s.daysAgo(Math.floor(diff / DAY));
    const d = new Date(ts);
    const pad = (x) => String(x).padStart(2, '0');
    if (lang.startsWith('zh')) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    const opts = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString(undefined, opts);
  }

  function render() {
    const q = (searchEl.value || '').trim().toLowerCase();
    const s = t();
    const filtered = entries.filter((e) => {
      if (!q) return true;
      return (
        (e.name || '').toLowerCase().includes(q) ||
        (e.path || '').toLowerCase().includes(q) ||
        (e.note || '').toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty">${s.empty}</div>`;
      return;
    }

    listEl.innerHTML = '';
    for (const e of filtered) {
      const row = document.createElement('div');
      row.className = 'row' + (e.pinned ? ' pinned' : '');
      row.dataset.path = e.path;

      // 收藏星标：始终显示，置顶时金色
      const star = btn(ICONS.star, e.pinned ? s.unpin : s.pin, () => {
        vscode.postMessage({ command: 'togglePin', path: e.path });
      });
      star.classList.add('star');
      star.classList.toggle('pinned', !!e.pinned);

      const info = document.createElement('div');
      info.className = 'info';
      info.title = e.path;
      info.addEventListener('click', (ev) => open(ev, e.path));

      // 第一行：文件夹名 | 备注 | 最后一次编辑时间（三列对齐）
      const line1 = document.createElement('div');
      line1.className = 'line1';

      const fullName = e.name || e.path;
      const colName = document.createElement('div');
      colName.className = 'col-name';
      colName.textContent = cap(fullName, 25);
      colName.title = fullName;

      const colNote = document.createElement('div');
      colNote.className = 'col-note';
      colNote.textContent = e.note || '';
      colNote.title = e.note || '';

      const colTime = document.createElement('div');
      colTime.className = 'col-time';
      colTime.textContent = formatTime(e.lastEditedAt);

      line1.append(colName, colNote, colTime);

      // 第二行：完整路径
      const line2 = document.createElement('div');
      line2.className = 'line2';
      line2.textContent = e.path;

      info.append(line1, line2);

      const actions = document.createElement('div');
      actions.className = 'actions';

      const editBtn = btn(ICONS.edit, s.editNote, () => {
        vscode.postMessage({ command: 'editNote', path: e.path });
      });
      const delBtn = btn(ICONS.trash, s.remove, () => {
        vscode.postMessage({ command: 'remove', path: e.path });
      });
      actions.append(editBtn, delBtn);

      row.append(star, info, actions);
      listEl.appendChild(row);
    }
  }

  function btn(icon, title, onClick) {
    const b = document.createElement('button');
    b.innerHTML = icon;
    b.title = title;
    b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onClick();
    });
    return b;
  }

  function open(ev, path) {
    const newWindow = ev.ctrlKey || ev.metaKey;
    vscode.postMessage({ command: 'openProject', path, newWindow });
  }

  searchEl.addEventListener('input', render);

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'setEntries') {
      entries = msg.entries;
      lang = msg.lang;
      render();
    } else if (msg.type === 'setReady') {
      render();
    }
  });

  vscode.postMessage({ command: 'ready' });
})();