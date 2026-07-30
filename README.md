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
| Demo 实验室 | http://localhost:5173/demo.html |

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
  demo/               # Demo 实验室入口
docs/                 # 计划与步骤文档
```
