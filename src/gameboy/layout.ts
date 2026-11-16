/**
 * Gameboy 设计稿坐标（单位：设计像素）。
 * 源 PNG 按 PIXEL_SCALE 放大：1 设计像素 = 30 源图像素。
 * 坐标相对舞台左上角（= body 左上角）。微调时只改本文件。
 */

export const PIXEL_SCALE = 30;

/** 舞台 / body 基准尺寸（设计像素） */
export const STAGE = {
  width: 40,
  height: 58,
} as const;

export const STAGE_PX = {
  width: STAGE.width * PIXEL_SCALE, // 1200
  height: STAGE.height * PIXEL_SCALE, // 1740
} as const;

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LayerId =
  | "body"
  | "screen"
  | "dpadShadow"
  | "dpad"
  | "btnBShadow"
  | "btnB"
  | "btnAShadow"
  | "btnA"
  | "selectShadow"
  | "select"
  | "startShadow"
  | "start";

export type LayerDef = Rect & {
  id: LayerId;
  src: string;
  /** 绘制顺序（小 → 大） */
  z: number;
};

const asset = (name: string) => `/assets/gameboy/${name}`;

/**
 * 图层摆放（相对 body）。
 * 阴影略偏左上/偏大，按钮叠在阴影之上 —— 与切图像素尺寸对齐。
 */
export const LAYERS: readonly LayerDef[] = [
  { id: "body", x: 0, y: 0, w: 40, h: 58, z: 0, src: asset("body.png") },
  { id: "screen", x: 3, y: 5, w: 34, h: 26, z: 10, src: asset("screen.png") },

  {
    id: "dpadShadow",
    x: 5,
    y: 34,
    w: 11,
    h: 12,
    z: 20,
    src: asset("dpad-shadow.png"),
  },
  { id: "dpad", x: 5, y: 34, w: 11, h: 11, z: 21, src: asset("dpad.png") },

  {
    id: "btnBShadow",
    x: 25,
    y: 37.5,
    w: 6,
    h: 6,
    z: 20,
    src: asset("btn-action-shadow.png"),
  },
  { id: "btnB", x: 26, y: 37, w: 5, h: 5, z: 21, src: asset("btn-action.png") },
  {
    id: "btnAShadow",
    x: 31,
    y: 33.5,
    w: 6,
    h: 6,
    z: 20,
    src: asset("btn-action-shadow.png"),
  },
  { id: "btnA", x: 32, y: 33, w: 5, h: 5, z: 21, src: asset("btn-action.png") },

  {
    id: "selectShadow",
    x: 13.5,
    y: 46,
    w: 6,
    h: 5,
    z: 20,
    src: asset("btn-option-shadow.png"),
  },
  {
    id: "select",
    x: 14,
    y: 46,
    w: 6,
    h: 4,
    z: 21,
    src: asset("btn-option.png"),
  },
  {
    id: "startShadow",
    x: 20.5,
    y: 46,
    w: 6,
    h: 5,
    z: 20,
    src: asset("btn-option-shadow.png"),
  },
  {
    id: "start",
    x: 21,
    y: 46,
    w: 6,
    h: 4,
    z: 21,
    src: asset("btn-option.png"),
  },
] as const;

/**
 * 绿屏可绘制内容区（相对舞台，设计像素）。
 * 对齐 screen.png 黑框内缘：相对 screen 层局部约 (7,5)+(21×14) → 舞台 (10,10)。
 * （相对旧标定左、下各扩 1 格，避免黑框内留空。）
 */
export const SCREEN_CONTENT: Rect = {
  x: 10,
  y: 10,
  w: 21,
  h: 14,
};

/** 完整屏幕图层（screen.png），聚焦时以此为适配目标。 */
export const SCREEN_FRAME: Rect = (() => {
  const screen = LAYERS.find((layer) => layer.id === "screen");
  if (!screen) throw new Error("screen layer missing");
  return { x: screen.x, y: screen.y, w: screen.w, h: screen.h };
})();

/** 聚焦后屏幕相对窗口的外边距（CSS px；已贴边时再调几乎无感）。 */
export const FOCUS_MARGIN_PX = 4;

/**
 * 在「完整 screen 刚好放入窗口」的基础上，再放大多少设计格。
 * 例如 2 → 相对当前再大约 2/26（按短边），会略微裁切屏幕外缘。
 */
export const FOCUS_EXTRA_GRIDS = 10;

export const FOCUS_TRANSFORM_ORIGIN = {
  x: ((SCREEN_FRAME.x + SCREEN_FRAME.w / 2) / STAGE.width) * 100,
  y: ((SCREEN_FRAME.y + SCREEN_FRAME.h / 2) / STAGE.height) * 100,
} as const;

export const FOCUS_TRANSITION_MS = 750;

export function rectToPercent(rect: Rect): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${(rect.x / STAGE.width) * 100}%`,
    top: `${(rect.y / STAGE.height) * 100}%`,
    width: `${(rect.w / STAGE.width) * 100}%`,
    height: `${(rect.h / STAGE.height) * 100}%`,
  };
}
