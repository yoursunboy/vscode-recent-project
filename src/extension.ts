import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { ProjectStore } from './store';
import { ProjectViewProvider } from './view';
import { readRecentFromStorage } from './storage';
import { normalizePath } from './history';
import type { ProjectEntry } from './types';

export function activate(context: vscode.ExtensionContext): void {
  const store = new ProjectStore(context.globalState);
  let wasmFailureShown = false;

  const viewProvider = new ProjectViewProvider(context, (msg) => {
    handleAction(msg);
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ProjectViewProvider.viewType, viewProvider)
  );

  // 记录当前工作区（每次激活、切窗口、增删文件夹）
  const recordCurrent = () => {
    const folders = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [];
    store.recordOpened(folders);
    refresh();
  };

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(recordCurrent),
    vscode.commands.registerCommand('recentProject.refresh', () => {
      recordCurrent();
    })
  );

  // 启动时读取历史
  void (async () => {
    try {
      const wasmPath =
        [path.join(context.extensionPath, 'dist', 'sql-wasm.wasm')].find((p) => fs.existsSync(p)) ??
        path.join(context.extensionPath, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
      const historyPaths = await readRecentFromStorage(wasmPath);
      store.mergeHistory(historyPaths);
    } catch (err) {
      if (!wasmFailureShown) {
        wasmFailureShown = true;
        void vscode.window.showWarningMessage(
          'Recent Projects: unable to read VS Code history (' + String(err) + ')'
        );
      }
    }
    recordCurrent();
  })();

  function refresh(): void {
    // 隐藏不存在的文件夹（无效项目不显示）
    const existing = store
      .list()
      .filter((e) => fs.existsSync(e.path))
      .map((e) => ({
        ...e,
        lastEditedAt: getFolderLastEdited(e.path),
      }));
    // 默认时间倒序：先按最后一次编辑时间（缺省回退到打开时间），置顶项仍在最前
    existing.sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) {
        return a.pinned ? -1 : 1;
      }
      const ta = a.lastEditedAt ?? a.lastOpenedAt ?? 0;
      const tb = b.lastEditedAt ?? b.lastOpenedAt ?? 0;
      return tb - ta;
    });
    viewProvider.setEntries(existing);
  }

  function getFolderLastEdited(folderPath: string): number | undefined {
    try {
      const root = fs.statSync(folderPath);
      let latest = root.mtimeMs;
      const stack = [folderPath];
      let scanned = 0;
      while (stack.length > 0 && scanned < 2000) {
        const dir = stack.pop()!;
        let entries: fs.Dirent[];
        try {
          entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
          continue;
        }
        for (const ent of entries) {
          const full = path.join(dir, ent.name);
          try {
            const st = fs.statSync(full);
            if (st.mtimeMs > latest) {
              latest = st.mtimeMs;
            }
            if (ent.isDirectory()) {
              stack.push(full);
            }
          } catch {
            // 跳过无法访问的项
          }
          scanned++;
        }
      }
      return latest;
    } catch {
      return undefined;
    }
  }

  function handleAction(msg: { command: string; path?: string; newWindow?: boolean; note?: string }): void {
    switch (msg.command) {
      case 'openProject': {
        openProject(msg.path ?? '', !!msg.newWindow);
        break;
      }
      case 'togglePin': {
        if (msg.path) {
          store.togglePin(msg.path);
          refresh();
        }
        break;
      }
      case 'editNote': {
        if (msg.path) {
          editNote(msg.path);
        }
        break;
      }
      case 'remove': {
        if (msg.path) {
          store.remove(msg.path);
          refresh();
        }
        break;
      }
      default:
        break;
    }
  }

  async function openProject(p: string, newWindow: boolean): Promise<void> {
    if (!fs.existsSync(p)) {
      void vscode.window.showWarningMessage(`Path does not exist: ${p}`);
      return;
    }
    const uri = vscode.Uri.file(p);
    try {
      await vscode.commands.executeCommand('vscode.openFolder', uri, {
        forceNewWindow: newWindow,
      });
    } catch (err) {
      void vscode.window.showErrorMessage('Failed to open project: ' + String(err));
    }
  }

  async function editNote(p: string): Promise<void> {
    const entry: ProjectEntry | undefined = store.list().find((e) => normalizePath(e.path) === normalizePath(p));
    const current = entry?.note ?? '';
    const note = await vscode.window.showInputBox({
      prompt: vscode.l10n.t('Note name for this project (leave empty to clear)'),
      value: current,
      placeHolder: vscode.l10n.t('Note'),
    });
    if (note === undefined) {
      return; // 用户取消
    }
    store.setNote(p, note);
    refresh();
  }
}

export function deactivate(): void {
  // noop
}
