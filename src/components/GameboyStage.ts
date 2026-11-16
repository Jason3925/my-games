import {
  FOCUS_EXTRA_GRIDS,
  FOCUS_MARGIN_PX,
  FOCUS_TRANSFORM_ORIGIN,
  FOCUS_TRANSITION_MS,
  LAYERS,
  SCREEN_CONTENT,
  SCREEN_FRAME,
  rectToPercent,
  type LayerId,
  type Rect,
} from '../gameboy/layout'
import { mountDPad, type DPadHandle } from './controls/DPad'
import { mountPressButton, type PressButtonHandle } from './controls/PressButton'
import { bindControlKeyboard } from './controls/keyboard'
import type { ButtonId, ControlListener } from './controls/types'
import './GameboyStage.css'
import './controls/controls.css'

export type GameboyStageOptions = {
  /** 显示绿屏内容区描边，便于核对坐标。也可 URL `?debugScreen=1` */
  showContentBounds?: boolean
  /** 预留：屏幕内容层子节点（步骤 3+） */
  screenContent?: Node | null
  /** 启用控件交互（Demo 默认开；正式页默认可关） */
  interactive?: boolean
  /** 绑定键盘映射（需 interactive） */
  bindKeyboard?: boolean
  onControl?: ControlListener
}

export type GameboyStageHandle = {
  root: HTMLElement
  /** 放大至屏幕焦点 + 外围蒙版变暗 */
  setFocusMode: (enabled: boolean) => void
  isFocusMode: () => boolean
  destroy: () => void
}

function applyRect(el: HTMLElement, rect: Rect): void {
  const box = rectToPercent(rect)
  el.style.left = box.left
  el.style.top = box.top
  el.style.width = box.width
  el.style.height = box.height
}

function expandRect(rect: Rect, pad: number): Rect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    w: rect.w + pad * 2,
    h: rect.h + pad * 2,
  }
}

function shouldShowBounds(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit
  return new URLSearchParams(location.search).get('debugScreen') === '1'
}

function requireLayer(
  layers: Map<LayerId, HTMLImageElement>,
  id: LayerId,
): HTMLImageElement {
  const el = layers.get(id)
  if (!el) throw new Error(`missing layer: ${id}`)
  return el
}

function layerRect(id: LayerId): Rect {
  const layer = LAYERS.find((item) => item.id === id)
  if (!layer) throw new Error(`missing layer def: ${id}`)
  return layer
}

function createHitArea(
  stage: HTMLElement,
  rect: Rect,
  zIndex: number,
  label: string,
): HTMLButtonElement {
  const hit = document.createElement('button')
  hit.type = 'button'
  hit.className = 'control-hit'
  hit.setAttribute('aria-label', label)
  hit.style.zIndex = String(zIndex)
  applyRect(hit, expandRect(rect, 0.75))
  stage.append(hit)
  return hit
}

/** Gameboy 图层合成；可选挂接控件交互。 */
export function mountGameboyStage(
  host: HTMLElement,
  options: GameboyStageOptions = {},
): GameboyStageHandle {
  const viewport = document.createElement('div')
  viewport.className = 'gameboy-viewport'

  const stage = document.createElement('div')
  stage.className = 'gameboy-stage'
  stage.setAttribute('role', 'img')
  stage.setAttribute('aria-label', '像素 Gameboy 机身')

  const layerEls = new Map<LayerId, HTMLImageElement>()
  const layers = [...LAYERS].sort((a, b) => a.z - b.z)
  for (const layer of layers) {
    const img = document.createElement('img')
    img.className = 'gameboy-layer'
    img.src = layer.src
    img.alt = ''
    img.draggable = false
    img.dataset.layer = layer.id
    img.style.zIndex = String(layer.z)
    applyRect(img, layer)
    layerEls.set(layer.id, img)
    stage.append(img)
  }

  const screenSlot = document.createElement('div')
  screenSlot.className = 'gameboy-screen-slot'
  screenSlot.dataset.slot = 'screen-content'
  screenSlot.style.zIndex = '15'
  applyRect(screenSlot, SCREEN_CONTENT)
  if (options.screenContent) {
    screenSlot.append(options.screenContent)
  }
  stage.append(screenSlot)

  const focusMask = document.createElement('div')
  focusMask.className = 'gameboy-focus-mask'
  focusMask.setAttribute('aria-hidden', 'true')
  stage.append(focusMask)

  // 从屏幕中心放大，动画才像「从 Gameboy 屏幕长出来」
  stage.style.transformOrigin = `${FOCUS_TRANSFORM_ORIGIN.x}% ${FOCUS_TRANSFORM_ORIGIN.y}%`

  if (shouldShowBounds(options.showContentBounds)) {
    const bounds = document.createElement('div')
    bounds.className = 'gameboy-content-bounds'
    bounds.dataset.debug = 'screen-content'
    applyRect(bounds, SCREEN_CONTENT)
    stage.append(bounds)
  }

  viewport.append(stage)
  host.append(viewport)

  const cleanups: Array<() => void> = []
  let focusMode = false
  let focusRaf: number | null = null
  let focusBgTimer: number | null = null
  let focusMaskTimer: number | null = null
  const TRANSITION =
    `transform ${FOCUS_TRANSITION_MS}ms cubic-bezier(0.32, 0, 0.2, 1)`

  const clearFocusTransform = () => {
    stage.style.transform = 'translate(0px, 0px) scale(1)'
  }

  const viewSize = () => {
    const vv = window.visualViewport
    return {
      width: vv?.width ?? document.documentElement.clientWidth,
      height: vv?.height ?? document.documentElement.clientHeight,
      left: vv?.offsetLeft ?? 0,
      top: vv?.offsetTop ?? 0,
    }
  }

  /**
   * 用屏幕图层的实测矩形计算 scale / translate。
   * origin 在屏幕中心：scale 时中心不动，translate 把中心移到视口中心。
   */
  const applyFocusTransform = () => {
    const screenLayer = layerEls.get('screen')
    if (!screenLayer) return

    const stageW = viewport.clientWidth
    const stageH = viewport.clientHeight
    if (stageW <= 0 || stageH <= 0) return

    // 必须在 identity 下测量；调用方保证此时 transform 为 1
    const screenRect = screenLayer.getBoundingClientRect()
    if (screenRect.width <= 0 || screenRect.height <= 0) return

    const view = viewSize()
    const margin = Math.max(0, FOCUS_MARGIN_PX)
    const availW = Math.max(1, view.width - margin * 2)
    const availH = Math.max(1, view.height - margin * 2)

    const fitScale = Math.min(
      availW / screenRect.width,
      availH / screenRect.height,
    )
    const limitingGrids =
      availH / screenRect.height <= availW / screenRect.width
        ? SCREEN_FRAME.h
        : SCREEN_FRAME.w
    const scale =
      fitScale * ((limitingGrids + FOCUS_EXTRA_GRIDS) / limitingGrids)

    const cx = screenRect.left + screenRect.width / 2
    const cy = screenRect.top + screenRect.height / 2
    const targetCx = view.left + view.width / 2
    const targetCy = view.top + view.height / 2

    // origin=屏幕中心时，scale 不移动中心，只需平移到视口中心
    const tx = targetCx - cx
    const ty = targetCy - cy

    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
  }

  const runFocusIn = () => {
    // 1) 先钉在 identity，保证过渡起点是「完整 Gameboy」
    stage.style.transition = 'none'
    clearFocusTransform()
    void stage.offsetWidth

    // 2) 再开 transition，下一帧落到目标（从屏幕中心放大并移到正中）
    stage.style.transition = TRANSITION
    if (focusRaf !== null) window.cancelAnimationFrame(focusRaf)
    focusRaf = window.requestAnimationFrame(() => {
      focusRaf = window.requestAnimationFrame(() => {
        focusRaf = null
        if (!focusMode) return
        applyFocusTransform()
      })
    })
  }

  const onFocusResize = () => {
    if (!focusMode) return
    stage.style.transition = 'none'
    clearFocusTransform()
    void stage.offsetWidth
    applyFocusTransform()
    stage.style.transition = TRANSITION
  }

  const clearBgTimer = () => {
    if (focusBgTimer !== null) {
      window.clearTimeout(focusBgTimer)
      focusBgTimer = null
    }
  }

  const clearMaskTimer = () => {
    if (focusMaskTimer !== null) {
      window.clearTimeout(focusMaskTimer)
      focusMaskTimer = null
    }
  }

  const clearMask = () => {
    clearMaskTimer()
    viewport.classList.remove('is-mask-active')
  }

  const setFocusMode = (enabled: boolean) => {
    focusMode = enabled
    viewport.classList.toggle('is-focused', enabled)
    const screenLayer = layerEls.get('screen')
    if (screenLayer) {
      screenLayer.style.zIndex = enabled ? '30' : '10'
    }
    screenSlot.style.zIndex = enabled ? '31' : '15'

    if (enabled) {
      clearBgTimer()
      clearMask()
      runFocusIn()
      // 放大结束后再把页面背景压黑，避免起手突兀
      focusBgTimer = window.setTimeout(() => {
        focusBgTimer = null
        if (!focusMode) return
        document.body.classList.add('is-game-focused')
      }, FOCUS_TRANSITION_MS)
      // 同步：放大结束后再出现屏幕外遮罩，遮住残留机身
      focusMaskTimer = window.setTimeout(() => {
        focusMaskTimer = null
        if (!focusMode) return
        viewport.classList.add('is-mask-active')
      }, FOCUS_TRANSITION_MS)
      window.addEventListener('resize', onFocusResize)
    } else {
      clearBgTimer()
      document.body.classList.remove('is-game-focused')
      // 缩小时遮罩直接消失，避免「慢半拍跟缩放」
      clearMask()
      window.removeEventListener('resize', onFocusResize)
      if (focusRaf !== null) {
        window.cancelAnimationFrame(focusRaf)
        focusRaf = null
      }
      stage.style.transition = TRANSITION
      clearFocusTransform()
    }
  }

  if (options.interactive) {
    stage.classList.add('is-interactive')
    const emit: ControlListener = (event) => options.onControl?.(event)

    const dpadHit = createHitArea(stage, layerRect('dpad'), 40, '方向键')
    const dpad: DPadHandle = mountDPad({
      face: requireLayer(layerEls, 'dpad'),
      shadow: requireLayer(layerEls, 'dpadShadow'),
      hitTarget: dpadHit,
      onEvent: emit,
    })
    cleanups.push(() => {
      dpad.destroy()
      dpadHit.remove()
    })

    const buttonSpecs: Array<{
      id: ButtonId
      face: LayerId
      shadow: LayerId
      variant: 'action' | 'option'
      label: string
    }> = [
      { id: 'a', face: 'btnA', shadow: 'btnAShadow', variant: 'action', label: 'A' },
      { id: 'b', face: 'btnB', shadow: 'btnBShadow', variant: 'action', label: 'B' },
      {
        id: 'select',
        face: 'select',
        shadow: 'selectShadow',
        variant: 'option',
        label: 'Select',
      },
      {
        id: 'start',
        face: 'start',
        shadow: 'startShadow',
        variant: 'option',
        label: 'Start',
      },
    ]

    const buttons = {} as Record<ButtonId, PressButtonHandle>
    for (const spec of buttonSpecs) {
      const hit = createHitArea(stage, layerRect(spec.face), 40, spec.label)
      const btn = mountPressButton({
        id: spec.id,
        face: requireLayer(layerEls, spec.face),
        shadow: requireLayer(layerEls, spec.shadow),
        hitTarget: hit,
        onEvent: emit,
        variant: spec.variant,
      })
      buttons[spec.id] = btn
      cleanups.push(() => {
        btn.destroy()
        hit.remove()
      })
    }

    if (options.bindKeyboard !== false) {
      cleanups.push(bindControlKeyboard({ dpad, buttons }))
    }
  }

  return {
    root: viewport,
    setFocusMode,
    isFocusMode: () => focusMode,
    destroy() {
      clearBgTimer()
      clearMask()
      document.body.classList.remove('is-game-focused')
      window.removeEventListener('resize', onFocusResize)
      if (focusRaf !== null) {
        window.cancelAnimationFrame(focusRaf)
        focusRaf = null
      }
      for (const fn of cleanups.splice(0).reverse()) fn()
      viewport.remove()
    },
  }
}
