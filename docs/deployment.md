# 部署

## 打包（生成 .vsix）

```bash
npm run package
```

等价于 `node esbuild.mjs && vsce package --allow-missing-repository`。

**打包前必须确认三件事**（任一不满足都会失败或装上即挂）：

1. **版本号**：`package.json` 的 `version` 每次都要**递增**（`0.1.0` → `0.1.1`），否则本地安装时 VS Code 认为已装过同版本。
2. **`engines.vscode`**：必须 `≥ @types/vscode`。当前为 `^1.95.0`，两者一致。
3. **`sql.js` 必须进包**：`.vscodeignore` 排除了 `node_modules/**`，但 `esbuild.mjs` 把 `sql.js` 设为 external，因此必须保留：
   ```
   node_modules/**
   !node_modules/sql.js
   !node_modules/sql.js/**
   ```
   否则安装后激活即报 `Cannot find module 'sql.js'`。

> `sql.js` 包内含多种 wasm（约 9MB 压缩后），属预期，不必裁剪。

## 本地安装

命令行方式：

```bash
code --install-extension recent-project-0.1.1.vsix --force
```

- `--force` 用于覆盖安装**同版本**；正常流程应每次递增版本号即可省略。
- 图形界面方式：`Ctrl+Shift+X` → 右上角 `...` → **Install from VSIX...** → 选择文件。

安装后需**重载窗口**（`Ctrl+Shift+P` → `Developer: Reload Window`）才生效。

## 验证安装

```bash
code --list-extensions | grep recent
# → local.recent-project
```

启动后活动栏出现「最近项目」图标，点击可见项目列表。

## 版本管理与发布节奏

1. 改代码 → `npm run test` 过 → 递增 `version` → `npm run package` → 安装验证。
2. 若同时改了「注意点 / 坑」，更新 `docs/notes.md`。

## 上架 VS Code Marketplace（对外分发）

目前 publisher 为 `local`，仅供本地安装。要对外发布：

1. 注册 publisher：<https://marketplace.visualstudio.com/manage>（用 Azure DevOps 账号）。
2. 把 `package.json` 的 `publisher` 从 `local` 改为你的 publisher ID。
3. 安装并登录 `@vscode/vsce`：`npx vsce login <publisher>`。
4. 发布：`npx vsce publish`（会自动 `vsce package`）。
5. 记得 `package.json` 里补 `repository` 字段并去掉 `--allow-missing-repository`。

### 发布前建议补充

- 仓库根目录 `README.md`（vsce 会告警缺失，Marketplace 展示需要）。
- `CHANGELOG.md`、`LICENSE`。
- 打包产物里不要包含 `docs/**` 与 `src/**` 等（见 `.vscodeignore`）。
