import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { isProjectPath, normalizePath, parseHistory } from './history';

export type AppKind = 'code' | 'insiders' | 'vscodium' | 'cursor';

export const APP_KINDS: AppKind[] = ['code', 'insiders', 'vscodium', 'cursor'];

/**
 * 定位某类 VSCode 变体的 storage 目录。
 * 覆盖 Linux / macOS / Windows。
 */
export function storageDir(kind: AppKind, homeDir = os.homedir()): string | null {
  const home = path.normalize(homeDir);
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (!appData) {
      return null;
    }
    return path.join(appData, kindName(kind), 'User');
  }
  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', kindName(kind), 'User');
  }
  // linux
  const config = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
  return path.join(config, kindName(kind), 'User');
}

function kindName(kind: AppKind): string {
  switch (kind) {
    case 'code':
      return 'Code';
    case 'insiders':
      return 'Code - Insiders';
    case 'vscodium':
      return 'VSCodium';
    case 'cursor':
      return 'Cursor';
  }
}

/** 从 URI（字符串或对象）中提取本地文件系统路径 */
function uriToPath(uri: unknown): string | null {
  if (!uri) {
    return null;
  }
  // 对象形式：{ fsPath } / { path } / { external }
  if (typeof uri === 'object') {
    const obj = uri as Record<string, unknown>;
    if (obj.fsPath && typeof obj.fsPath === 'string') {
      return obj.fsPath;
    }
    if (typeof obj.path === 'string') {
      return obj.path;
    }
    if (typeof obj.external === 'string') {
      return uriStringToPath(obj.external);
    }
    return null;
  }
  // 字符串形式：file:///d%3A/proj 或 {path}
  if (typeof uri === 'string') {
    return uriStringToPath(uri);
  }
  return null;
}

function uriStringToPath(s: string): string | null {
  if (s.startsWith('file:///')) {
    try {
      return decodeURIComponent(s.slice('file:///'.length));
    } catch {
      return s.slice('file:///'.length);
    }
  }
  return s;
}

/**
 * 读取各来源中的最近项目路径，去重保序。
 * 现代 VSCode 中 recent projects 的存放位置并不唯一，因此按优先级依次读取多个来源：
 *   1. state.vscdb 的 history.recentlyOpenedPathsList（经典键，Cursor / Insiders / 旧版 VSCode）
 *   2. state.vscdb 的 sessions.recentlyPickedWorkspaces
 *   3. globalStorage/storage.json 的 profileAssociations.workspaces（URI 表）
 *   4. storage.json 的 windowsState.openedWindows 与 backupWorkspaces.folders
 * 返回顺序即「最近优先」。
 */
export async function readRecentFromStorage(wasmPath: string): Promise<string[]> {
  const SQL = await initSqlJs({
    locateFile: () => wasmPath,
  });
  const seen = new Set<string>();
  const result: string[] = [];
  const add = (p: string | null) => {
    if (!p || typeof p !== 'string') {
      return;
    }
    if (!isProjectPath(p)) {
      return;
    }
    const key = normalizePath(p);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  };

  for (const kind of APP_KINDS) {
    const dir = storageDir(kind);
    if (!dir || !fs.existsSync(dir)) {
      continue;
    }

    // 经典 history 键：主 globalStorage + 各 profile 的 globalStorage
    const candidates = [path.join(dir, 'globalStorage', 'state.vscdb')];
    const profilesRoot = path.join(dir, 'profiles');
    if (fs.existsSync(profilesRoot)) {
      for (const prof of fs.readdirSync(profilesRoot)) {
        candidates.push(path.join(profilesRoot, prof, 'globalStorage', 'state.vscdb'));
      }
    }
    for (const dbPath of candidates) {
      if (!fs.existsSync(dbPath)) {
        continue;
      }
      try {
        readDbKeys(SQL, dbPath).forEach(add);
      } catch {
        // 单个来源失败不阻断其他来源
      }
    }

    // storage.json
    const storageJson = path.join(dir, 'globalStorage', 'storage.json');
    if (fs.existsSync(storageJson)) {
      try {
        readStorageJson(storageJson).forEach(add);
      } catch {
        // ignore
      }
    }
  }

  return result;
}

/** 从一个 state.vscdb 中读取 recent 相关键，返回原始路径字符串 */
function readDbKeys(SQL: SqlJsStatic, dbPath: string): string[] {
  const bytes = fs.readFileSync(dbPath);
  let db: Database | null = null;
  try {
    db = new SQL.Database(bytes);
    const out: string[] = [];
    // 1) 经典键
    const hist = queryValue(db, 'history.recentlyOpenedPathsList');
    if (hist) {
      let raw: unknown;
      try {
        raw = JSON.parse(hist);
      } catch {
        raw = null;
      }
      if (raw) {
        out.push(...parseHistory(raw));
      }
    }
    // 2) recentlyPickedWorkspaces
    const picked = queryValue(db, 'sessions.recentlyPickedWorkspaces');
    if (picked) {
      try {
        const arr = JSON.parse(picked) as unknown[];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            const uri = (item as Record<string, unknown>)?.uri;
            const p = uriToPath(uri);
            if (p) {
              out.push(p);
            }
          }
        }
      } catch {
        // ignore
      }
    }
    return out;
  } finally {
    if (db) {
      db.close();
    }
  }
}

function queryValue(db: Database, key: string): string | null {
  const res = db.exec(`SELECT value FROM ItemTable WHERE key = '${key}'`);
  if (res.length === 0 || res[0].values.length === 0) {
    return null;
  }
  const v = res[0].values[0][0];
  return typeof v === 'string' ? v : null;
}

/** 从 storage.json 读取 workspace 相关 URI */
function readStorageJson(jsonPath: string): string[] {
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, unknown>;
  const out: string[] = [];

  // profileAssociations.workspaces: { "file:///...": "profile" }
  const associations = raw.profileAssociations as Record<string, unknown> | undefined;
  if (associations && typeof associations === 'object') {
    const workspaces = associations.workspaces as Record<string, unknown> | undefined;
    if (workspaces && typeof workspaces === 'object') {
      for (const uriKey of Object.keys(workspaces)) {
        const p = uriToPath(uriKey);
        if (p) {
          out.push(p);
        }
      }
    }
  }

  // windowsState.openedWindows: [{ folder: "file:///..." }]
  const winState = raw.windowsState as Record<string, unknown> | undefined;
  if (winState && typeof winState === 'object') {
    const opened = winState.openedWindows as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(opened)) {
      for (const w of opened) {
        const p = uriToPath((w as Record<string, unknown>).folder);
        if (p) {
          out.push(p);
        }
      }
    }
    const last = winState.lastActiveWindow as Record<string, unknown> | undefined;
    if (last && typeof last === 'object') {
      const p = uriToPath(last.folder);
      if (p) {
        out.push(p);
      }
    }
  }

  // backupWorkspaces.folders: [{ folderUri: { fsPath } }]
  const backups = raw.backupWorkspaces as Record<string, unknown> | undefined;
  if (backups && typeof backups === 'object') {
    const folders = backups.folders as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(folders)) {
      for (const f of folders) {
        const p = uriToPath((f as Record<string, unknown>).folderUri);
        if (p) {
          out.push(p);
        }
      }
    }
  }

  return out;
}
