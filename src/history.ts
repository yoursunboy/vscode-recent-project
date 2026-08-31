import * as path from 'node:path';

/**
 * 规范化路径：统一分隔符为 /，去掉末尾分隔符，折叠大小写无关的比较键。
 * 返回规范化的绝对路径，Windows 下统一为小写以忽略大小写差异。
 */
export function normalizePath(p: string): string {
  let normalized = p.replace(/\\/g, '/').replace(/\/+$/, '');
  if (/^[a-zA-Z]:/.test(normalized)) {
    normalized = normalized.charAt(0).toLowerCase() + normalized.slice(1);
  }
  return normalized;
}

/** 从路径取最后一段作为展示名（处理末尾分隔符） */
export function basename(p: string): string {
  const normalized = p.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}

/**
 * 判断一个历史条目是否是「项目」（文件夹或 workspace 文件），
 * 排除单个文件、远程/非本地 scheme 等。
 */
export function isProjectPath(p: string): boolean {
  const normalized = p.replace(/\\/g, '/');
  // 远程或非本地工作区（vscode-remote://、vscode-insiders:// 等），本插件聚焦本地文件夹
  if (/^[a-z]+-remote:\/\//i.test(normalized) || /^[a-z]+-insiders:\/\//i.test(normalized)) {
    return false;
  }
  // 单文件（非 workspace）
  if (normalized.endsWith('.code-workspace')) {
    return true;
  }
  // 以扩展名结尾但非 workspace 的，视为文件而非项目
  if (path.extname(normalized) !== '') {
    return false;
  }
  return true;
}

/** 解析 VSCode 历史条目的多种形态，返回其中的项目路径数组 */
export function extractProjectPaths(raw: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      collectFromItem(item, out);
    }
  } else if (raw && typeof raw === 'object') {
    // 新格式：{ entries: [...] } 或 { folders: [...] }
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.entries)) {
      for (const item of obj.entries) {
        collectFromItem(item, out);
      }
    }
    if (Array.isArray(obj.folders)) {
      for (const item of obj.folders) {
        collectFromItem(item, out);
      }
    }
  }
  return out;
}

function collectFromItem(item: unknown, out: string[]): void {
  if (!item || typeof item !== 'object') {
    return;
  }
  const obj = item as Record<string, unknown>;
  // 可能为对象 { path } 或 file:// URI 字符串
  const pushUri = (v: unknown) => {
    const p = uriToFsPath(v);
    if (p) {
      out.push(p);
    }
  };
  pushUri(obj.folderUri);
  pushUri(obj.workspace);
  pushUri(obj.fileUri);
  if (typeof obj.path === 'string') {
    out.push(obj.path);
  }
}

/**
 * 将 file:/// 形式的 URI（字符串或 { path } 对象）转换为本地文件系统路径。
 * 仅处理 file scheme；其他 scheme（vscode-remote 等）原样返回 path。
 */
function uriToFsPath(v: unknown): string | null {
  if (!v) {
    return null;
  }
  let raw: string | null = null;
  if (typeof v === 'string') {
    raw = v;
  } else if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.path === 'string') {
      raw = o.path as string;
    }
  }
  if (raw === null) {
    return null;
  }
  if (raw.startsWith('file:///')) {
    // file:///d%3A/proj -> d:/proj
    try {
      return decodeURIComponent(raw.slice('file:///'.length));
    } catch {
      return raw.slice('file:///'.length);
    }
  }
  return raw;
}

/** 从历史条目中找出文件夹/workspace 项目的规范化路径（去重保序） */
export function parseHistory(raw: unknown): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const p of extractProjectPaths(raw)) {
    if (typeof p !== 'string' || p.length === 0) {
      continue;
    }
    if (!isProjectPath(p)) {
      continue;
    }
    const key = normalizePath(p);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(key);
  }
  return result;
}
