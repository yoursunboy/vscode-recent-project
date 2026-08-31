# 注意事项 / 踩坑记录

> 本文件记录开发中实际踩过的坑、设计取舍与已知限制，改代码前先看一遍，避免重复踩。

## 打包相关（每条都是真实踩过）

### `engines.vscode` 与 `@types/vscode` 不一致

- **现象**：`@types/vscode: ^1.95.0` 而 `engines.vscode: ^1.85.0` 时，`vsce package` 直接报错退出：
  `@types/vscode ^1.95.0 greater than engines.vscode ^1.85.0`。
- **原因**：vsce 校验 `engines.vscode` 必须 ≥ 类型声明版本，避免用到旧版本不存在的 API。
- **规则**：两者保持对齐（当前 `^1.95.0`）。升级 `@types/vscode` 时必须同步升 `engines.vscode`。

### sql.js 不进包 → 装上激活即崩

- **现象**：安装后激活报 `Cannot find module 'sql.js'`。
- **原因链**：`esbuild.mjs` 把 `sql.js` 设为 `external`（Emscripten 胶水打包易坏）→ `dist/extension.js` 顶层 `require("sql.js")` → 但 `.vscodeignore` 排除了 `node_modules/**` → vsix 里没有 sql.js。
- **规则**：`.vscodeignore` 必须用 `!node_modules/sql.js` / `!node_modules/sql.js/**` 白名单保留它。改依赖前先确认它是否被 external。

### Webview 资源路径（已修复，务必记住）

- **现象**：本地开发正常，**安装版列表空白**。
- **原因**：esbuild 把 `media/` 拷进 `dist/media/`，同时 `.vscodeignore` 排除了根 `media/` → 安装版**没有**根 `media/`。但 `view.ts` 里 `asWebviewUri(extensionUri/'media'/...)` 与 `localResourceRoots` 引用的是根 `media/` → CSS/JS 全部 404 → main.js 没执行 → 没有任何渲染。
- **规则**：**Webview 资源一律引用 `dist/media`**（开发与安装版都存在，因为构建都会生成 `dist/media`）。新加媒体文件放 `media/`，构建自动拷入。
- **排查口诀**：症状「开发正常、安装空白」先查 webview 资源 404（`Ctrl+Shift+I` 打开 webview 开发者工具看 Network/Console）。

## 设计取舍

| 决策 | 原因 / 后果 |
|---|---|
| 数据读 VS Code 原生历史，不另存 | 避免重复维护；代价是依赖各变体存储结构（已覆盖 4 类来源） |
| 删除用「墓碑」（`removed` 标记） | 防止下次读历史时「复活」；墓碑条目不渲染 |
| 列表上限 `MAX_PROJECTS = 100` | 控制 globalState 体积与渲染开销 |
| 扫描 mtime 上限 2000 个文件 | 大目录（node_modules 等）不至于卡死；超大目录的最后编辑时间可能不精确 |
| `isProjectPath` 用扩展名判断「文件 vs 项目」 | 代价：**路径里带点的文件夹名（如 `a.v2/`）会被误判为文件而过滤掉**。属于已知限制 |
| 置顶项始终在最前，其余按最后编辑时间倒序 | 编辑时间缺省回退到打开时间 |
| 路径统一规范化为 `/` + Windows 盘符小写 | 保证跨写法去重稳定 |

## 已知限制

- 远程 / 非本地工作区（`vscode-remote://`、`vscode-insiders://`）不展示。
- 单文件历史不展示（只保留文件夹与 `.code-workspace`）。
- 带点的文件夹名可能被 `isProjectPath` 误过滤（见上表）。
- 实时性：依赖 VS Code 自身历史刷新；扩展在工作区变化 / 激活 / 手动刷新时读取。
- 只在本机生效：无法读取其他机器的 VS Code 历史。

## 数据存储位置

| 内容 | 位置 |
|---|---|
| 插件自身数据（entries/备注/置顶/墓碑） | VS Code `globalStorage` 的 `state.vscdb`，键 `local.recent-project` → `recentProject.entries` |
| 历史数据源 | `User/globalStorage/state.vscdb` + `storage.json`（各变体） |

> 调试时可直接用 sql.js 读 `%APPDATA%/Code/User/globalStorage/state.vscdb` 检查 `local.recent-project` 键内容，确认数据是否已写入。

## 开发环境注意

- 扩展开发宿主控制台的报错**大多数来自其他扩展**，与本扩展无关；停止调试时的 `Channel has been closed` / `Canceled` 属正常退出噪音（详见 [development.md](development.md#调试-f5)）。
