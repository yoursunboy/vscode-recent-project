import * as vscode from 'vscode';
import { MAX_PROJECTS, type ProjectEntry } from './types';
import { basename, normalizePath } from './history';

const STATE_KEY = 'recentProject.entries';

/**
 * 项目列表的存储与合并逻辑。
 * - 数据来自两部分：插件自身记录（globalState）与 VSCode 历史（history）。
 * - 合并时：历史提供「最近打开」排序线索，globalState 提供备注/置顶/墓碑。
 */
export class ProjectStore {
  private entries: ProjectEntry[] = [];
  /** 单调递增序列号，保证同一毫秒内合并的条目也能稳定排序 */
  private seq = 0;

  constructor(private state: vscode.Memento) {
    const stored = this.state.get<ProjectEntry[]>(STATE_KEY, []);
    this.entries = stored.filter((e) => e && typeof e.path === 'string');
  }

  /** 当前列表（按排序规则） */
  list(): ProjectEntry[] {
    return this.entries
      .filter((e) => !e.removed)
      .sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0);
      })
      .slice(0, MAX_PROJECTS);
  }

  /**
   * 合并新的历史项目路径，并记录一次打开时间。
   * @param paths 最近优先顺序：index 0 为最近打开。
   * 已被墓碑删除的项目不会复活。
   */
  mergeHistory(paths: string[]): void {
    // 逆序遍历，使 index 0（最近）获得最大时间戳，排序时排最前
    for (let i = paths.length - 1; i >= 0; i--) {
      const now = this.nextStamp();
      const key = normalizePath(paths[i]);
      const existing = this.entries.find((e) => normalizePath(e.path) === key);
      if (existing) {
        existing.lastOpenedAt = Math.max(existing.lastOpenedAt ?? 0, now);
        continue;
      }
      this.entries.push({
        path: key,
        name: basename(key),
        lastOpenedAt: now,
      });
    }
    this.persist();
  }

  /** 单调递增时间戳：取系统当前毫秒，但保证不小于上次已用值 + 1 */
  private nextStamp(): number {
    const now = Date.now();
    if (now > this.seq) {
      this.seq = now;
    } else {
      this.seq += 1;
    }
    return this.seq;
  }

  /** 记录当前打开的项目 */
  recordOpened(paths: string[]): void {
    this.mergeHistory(paths);
  }

  /** 设置备注 */
  setNote(pathKey: string, note: string): void {
    const entry = this.find(pathKey);
    if (!entry) {
      return;
    }
    entry.note = note.trim() === '' ? undefined : note.trim();
    this.persist();
  }

  /** 置顶/取消置顶 */
  togglePin(pathKey: string): void {
    const entry = this.find(pathKey);
    if (!entry) {
      return;
    }
    entry.pinned = !entry.pinned;
    this.persist();
  }

  /** 删除（墓碑） */
  remove(pathKey: string): void {
    const entry = this.find(pathKey);
    if (!entry) {
      return;
    }
    entry.removed = true;
    this.persist();
  }

  /** 清空墓碑（用于“恢复所有已删除”） */
  unremove(pathKey: string): void {
    const entry = this.find(pathKey);
    if (!entry) {
      return;
    }
    entry.removed = false;
    this.persist();
  }

  private find(pathKey: string): ProjectEntry | undefined {
    const key = normalizePath(pathKey);
    return this.entries.find((e) => normalizePath(e.path) === key);
  }

  private persist(): void {
    this.state.update(STATE_KEY, this.entries);
  }
}
