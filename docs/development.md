# 开发

## 环境要求

| 项 | 要求 |
|---|---|
| Node.js | ≥ 18（本机为 22） |
| VS Code | ≥ 1.95.0（与 `engines.vscode` 一致） |
| npm | 随 Node 自带 |
| 依赖 | `npm install` 安装 `sql.js` 等 |

> `@types/vscode`（`^1.95.0`）必须**不高于** `engines.vscode`，否则 `vsce package` 直接报错退出（详见 [notes.md](notes.md#enginesvscode-与-typesvscode-不一致)）。

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run compile` | 仅 `tsc --noEmit` 类型检查 |
| `npm run build` | 类型检查 + esbuild 构建到 `dist/` |
| `npm run test` | 编译并运行 Mocha 单元测试 |
| `npm run package` | 构建 + `vsce package` 生成 `.vsix` |

## 调试（F5）

- 配置在 `.vscode/launch.json`（`Run Extension`），`preLaunchTask` 会先执行 `npm: build`。
- 按 F5 启动**扩展开发宿主**：新窗口里只带本扩展 + 宿主内所有已装扩展的日志。
- **宿主控制台里绝大部分报错是其他扩展的（Claude Code、Copilot、Live Server 等），与本扩展无关**；尤其停止调试（Shift+F5）时的 `Channel has been closed` / `Canceled` 是正常退出噪音。
- 想确认本扩展行为，可在代码里加 `console.log`；或查看「输出」面板。

## 目录与职责

| 模块 | 职责 |
|---|---|
| `src/extension.ts` | 激活入口；注册 WebviewViewProvider 与命令；分发 `openProject / togglePin / editNote / remove` |
| `src/storage.ts` | 定位各 VS Code 变体存储目录；用 `sql.js` 读 `state.vscdb`、解析 `storage.json` |
| `src/history.ts` | 路径规范化（Windows 盘符小写）、`isProjectPath` 判定、历史条目解析 |
| `src/store.ts` | `ProjectStore`：合并历史、备注、置顶、墓碑删除、持久化到 `globalState` |
| `src/view.ts` | `ProjectViewProvider`：构造 Webview HTML、`asWebviewUri`、`postMessage` 推送 |
| `media/main.js` | Webview 渲染逻辑：列表、搜索、时间格式化、把用户操作回传扩展 |
| `media/style.css` | Webview 样式 |

## 数据流

```
VS Code 历史 (state.vscdb / storage.json)
   │  readRecentFromStorage(wasmPath)   ← sql.js 读库
   ▼
ProjectStore.mergeHistory(paths)        ← 去重 + 打时间戳 + 持久化 globalState
   │  list()
   ▼
extension.refresh()                     ← 过滤已删除/不存在 + 扫 mtime + 排序
   │  viewProvider.setEntries(entries)
   ▼
Webview postMessage {type:'setEntries'} ← main.js render()
```

## 测试

- 框架：Mocha + Node `assert`；测试在 `test/`（`history.spec.ts`、`store.spec.ts`）。
- 只测**纯逻辑**（路径规范化、历史解析、store 合并/排序/墓碑），不依赖 VS Code 宿主。
- `ProjectStore` 测试用最小 `FakeMemento` 假实现。
- 运行：`npm run test`。

> 新增纯函数逻辑（如新的路径处理、排序规则）时，请同步在 `test/` 补用例。

## 新增功能指引

1. **命令**：在 `package.json` → `contributes.commands` 声明，`package.nls*.json` 加标题，`extension.ts` 里 `registerCommand` 并注册到 `context.subscriptions`。
2. **Webview 交互**：`media/main.js` 里 `vscode.postMessage({command, ...})` → `extension.ts` 的 `handleAction` 分支处理 → 处理后调 `refresh()` 回推列表。
3. **新文案**：Webview 内加词条时同步补 `media/main.js` 的 `strings.zh/en`（注意与 `src/i18n.ts` 是两套，Webview 用 `main.js` 里的）。
4. **清单文案**：`package.nls.json`（en）与 `package.nls.zh-cn.json`（zh）同步修改。
5. **新数据源**：在 `src/storage.ts` 的 `readRecentFromStorage` 里按优先级追加，保证「失败不阻断」。
