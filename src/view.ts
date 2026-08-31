import * as vscode from 'vscode';
import { getStrings, type Strings } from './i18n';
import type { ProjectEntry } from './types';

type Msg =
  | { type: 'setEntries'; entries: ProjectEntry[]; lang: string }
  | { type: 'setReady' };

interface WebviewMessage {
  command: string;
  path?: string;
  note?: string;
}

/**
 * 侧边栏「最近项目」WebviewView。
 * 负责渲染列表、把用户交互回传给扩展。
 */
export class ProjectViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'recentProject.list';

  private view?: vscode.WebviewView;
  private entries: ProjectEntry[] = [];

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onAction: (m: WebviewMessage) => void
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      // esbuild 会把 media/ 拷进 dist/media/，.vscodeignore 又排除了根 media/，
      // 因此安装版里资源实际位于 dist/media/（开发时 dist/media/ 也存在）
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'media')],
    };

    const webview = webviewView.webview;
    const mediaUri = (file: string) =>
      webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'media', file));

    const state = this.getState();
    webview.html = this.renderHtml(webview, mediaUri, state);

    webview.onDidReceiveMessage((msg: WebviewMessage) => {
      if (msg.command === 'ready') {
        // webview 就绪后立即推送当前条目，避免首开为空
        this.postEntries();
        return;
      }
      this.onAction(msg);
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.postEntries();
      }
    });

    // 首次 resolve 时也推送一次
    this.postEntries();
  }

  /** 推最新列表给 webview */
  postEntries(): void {
    this.view?.webview.postMessage({
      type: 'setEntries',
      entries: this.entries,
      lang: vscode.env.language,
    });
  }

  /** 扩展侧刷新后调用 */
  setEntries(entries: ProjectEntry[]): void {
    this.entries = entries;
    this.postEntries();
  }

  /** 提示 webview 读取 initialData（首次渲染用） */
  private getState() {
    return { entries: this.entries, lang: vscode.env.language };
  }

  private renderHtml(
    webview: vscode.Webview,
    mediaUri: (f: string) => vscode.Uri,
    state: { entries: ProjectEntry[]; lang: string }
  ): string {
    const s: Strings = getStrings(state.lang);
    const css = mediaUri('style.css');
    const js = mediaUri('main.js');
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${css}">
<title>Recent Projects</title>
</head>
<body>
<div id="toolbar">
  <input id="search" type="search" placeholder="${s.placeholder}" />
</div>
<div id="list"></div>
<script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
