# my-games

像素掌机外壳 + Godot HTML 小游戏展柜。

## 安装

```bash
npm install
```

## 本地开发

```bash
npm run dev
```

启动后：

| 入口 | 地址 |
|------|------|
| 正式站 | http://localhost:5173/ |
| Demo 实验室（组件测试） | http://localhost:5173/demo/ |

## 构建

```bash
npm run build
```

产物输出到 `dist/`。可用 `npm run preview` 预览构建结果。

## 目录约定

```
public/
  games/              # Godot Web 导出
  assets/gameboy/     # 机身切图
  assets/covers/      # 游戏封面
  games.json          # 游戏元数据
src/
  app/                # 正式体验壳 / 状态机
  components/         # 可复用控件
  demo/               # Demo 实验室页面逻辑
demo/                 # Demo 路由入口（/demo/）
docs/                 # 计划与步骤文档
```

后续控件与屏幕 UI 的组件验收统一在 **`/demo/`** 完成，不进入完整游戏流程。

## 新增一款游戏（Godot Web）

1. 将导出文件放到 `public/games/<game-id>/`（需包含 `index.html`）。
2. 在 `public/games.json` 追加条目：

```json
{
  "id": "<game-id>",
  "title": "显示名称",
  "cover": "/games/<game-id>/index.png",
  "entry": "/games/<game-id>/index.html",
  "description": "一句话介绍"
}
```

当前已接入真实游戏：`/games/game-1/`（`Play With Fire`）。

## 部署说明（待你选择平台后补全 URL）

- 推荐：Cloudflare Pages / Vercel / GitHub Pages（纯静态托管）。
- 首次部署前，先本地执行：

```bash
npm run build
npm run preview
```

确认 `index.html` 与 `/games/game-1/index.html` 都可访问后再发布。
