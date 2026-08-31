# Recent Project 开发文档

> VS Code 侧边栏「最近项目」扩展：从 VS Code 自身的历史记录中读取最近打开的项目文件夹，在侧边栏 Webview 中展示，支持备注、置顶、删除、搜索、一键打开。

## 文档导航

| 文档 | 内容 |
|---|---|
| [requirements.md](requirements.md) | 需求：背景、功能需求、非功能需求、范围边界 |
| [features.md](features.md) | 功能：已实现功能清单、数据来源、排序规则 |
| [development.md](development.md) | 开发：环境、架构、目录结构、构建、调试、测试、扩展指引 |
| [deployment.md](deployment.md) | 部署：打包、本地安装、版本管理、上架 Marketplace |
| [notes.md](notes.md) | 注意事项：踩过的坑、设计取舍、已知限制 |

## 项目速览

| 项 | 值 |
|---|---|
| 名称 / 版本 | `recent-project` / 0.1.1（publisher: `local`） |
| 入口 | `src/extension.ts` |
| 技术栈 | TypeScript · VS Code Extension API · esbuild · sql.js · Webview |
| 最低 VS Code | `^1.95.0`（与 `@types/vscode` 对齐） |
| 构建 | esbuild 打包到 `dist/`，`sql.js` 保持 external |
| 数据持久化 | 扩展自身用 `globalState`（`state.vscdb`）；历史数据读 VS Code 原生存储 |

## 目录结构

```
.
├── src/                  # 扩展源码（TypeScript）
│   ├── extension.ts      # 入口：激活、注册视图/命令、动作分发
│   ├── storage.ts        # 读取 VS Code 原生历史（state.vscdb / storage.json）
│   ├── history.ts        # 路径规范化、历史条目解析、项目判定
│   ├── store.ts          # 项目列表的存储与合并（备注/置顶/墓碑）
│   ├── view.ts           # WebviewViewProvider：渲染侧边栏
│   ├── i18n.ts           # Webview 内文案（zh/en）
│   └── types.ts          # ProjectEntry 类型与常量
├── media/                # Webview 前端资源（main.js / style.css）
├── test/                 # Mocha 单元测试（history / store）
├── esbuild.mjs           # 构建脚本（打包 + 拷贝 wasm/media）
├── package.json          # 扩展清单、命令、激活事件、脚本
└── package.nls*.json     # 清单文案本地化（en / zh-cn）
```

> **注意**：esbuild 会把 `media/` 拷进 `dist/media/`。安装版里 Webview 资源实际位于 `dist/media/`，**不要**引用根目录 `media/`（见 [notes.md](notes.md#webview-资源路径)）。
