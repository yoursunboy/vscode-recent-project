/**
 * Webview 内的文案本地化。
 * 扩展将 vscode.env.language 传给 webview，webview 根据语言选择字典。
 */
export interface Strings {
  placeholder: string;
  empty: string;
  open: string;
  openNewWindow: string;
  editNote: string;
  clearNote: string;
  pin: string;
  unpin: string;
  remove: string;
  missing: string;
  note: string;
}

const en: Strings = {
  placeholder: 'Search projects…',
  empty: 'No recent projects',
  open: 'Open in current window',
  openNewWindow: 'Open in new window',
  editNote: 'Edit note',
  clearNote: 'Clear note',
  pin: 'Pin',
  unpin: 'Unpin',
  remove: 'Remove from list',
  missing: 'Path no longer exists',
  note: 'Note',
};

const zh: Strings = {
  placeholder: '搜索项目…',
  empty: '暂无最近项目',
  open: '在当前窗口打开',
  openNewWindow: '在新窗口打开',
  editNote: '编辑备注',
  clearNote: '清除备注',
  pin: '置顶',
  unpin: '取消置顶',
  remove: '从列表移除',
  missing: '路径已不存在',
  note: '备注',
};

export function getStrings(lang: string): Strings {
  if (lang.startsWith('zh')) {
    return zh;
  }
  return en;
}
