import type { ControlListener, PadDirection } from './types'

export type DPadHandle = {
  press: (direction: PadDirection) => void
  release: () => void
  destroy: () => void
}

type DPadOptions = {
  face: HTMLElement
  shadow: HTMLElement
  /** 接收指针的热区；默认用 face */
  hitTarget?: HTMLElement
  onEvent: ControlListener
  /** 中心死区（仅影响方向判定阈值，轻点中心仍会落到最近方向） */
  deadZone?: number
  repeatDelayMs?: number
  repeatIntervalMs?: number
  /** 轻点时按下态最短展示，便于看清反馈 */
  minPressMs?: number
}

/** 始终落到最近方向；死区过小时按主轴，完全中心默认 up。 */
export function directionFromPoint(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  deadZone = 0.08,
): PadDirection {
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return 'up'
  const x = (clientX - rect.left) / rect.width - 0.5
  const y = (clientY - rect.top) / rect.height - 0.5
  if (Math.abs(x) < deadZone && Math.abs(y) < deadZone) {
    if (Math.abs(x) < 0.02 && Math.abs(y) < 0.02) return 'up'
  }
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left'
  return y > 0 ? 'down' : 'up'
}

function clearTilt(face: HTMLElement, shadow: HTMLElement): void {
  face.dataset.tilt = ''
  shadow.dataset.tilt = ''
}

function applyTilt(
  face: HTMLElement,
  shadow: HTMLElement,
  direction: PadDirection,
): void {
  face.dataset.tilt = direction
  shadow.dataset.tilt = direction
}

/** D-Pad：四向热区 + 3D tilt + 阴影偏移。 */
export function mountDPad(options: DPadOptions): DPadHandle {
  const {
    face,
    shadow,
    hitTarget = face,
    onEvent,
    deadZone = 0.08,
    repeatDelayMs = 380,
    repeatIntervalMs = 110,
    minPressMs = 100,
  } = options

  face.classList.add('control-face', 'control-face--dpad')
  shadow.classList.add('control-shadow', 'control-shadow--dpad')
  hitTarget.classList.add('control-hit')
  hitTarget.style.touchAction = 'none'

  let active: PadDirection | null = null
  let pointerId: number | null = null
  let pressedAt = 0
  let releaseTimer: number | null = null
  let repeatDelayTimer: number | null = null
  let repeatTimer: number | null = null

  const clearRepeat = () => {
    if (repeatDelayTimer !== null) {
      window.clearTimeout(repeatDelayTimer)
      repeatDelayTimer = null
    }
    if (repeatTimer !== null) {
      window.clearInterval(repeatTimer)
      repeatTimer = null
    }
  }

  const clearReleaseTimer = () => {
    if (releaseTimer !== null) {
      window.clearTimeout(releaseTimer)
      releaseTimer = null
    }
  }

  const startRepeat = (direction: PadDirection) => {
    clearRepeat()
    repeatDelayTimer = window.setTimeout(() => {
      repeatTimer = window.setInterval(() => {
        onEvent({ type: 'dpad', direction, phase: 'repeat' })
      }, repeatIntervalMs)
    }, repeatDelayMs)
  }

  const engage = (direction: PadDirection) => {
    clearReleaseTimer()
    if (active === direction) return
    if (active) {
      onEvent({ type: 'dpad', direction: active, phase: 'up' })
      clearRepeat()
    }
    active = direction
    pressedAt = performance.now()
    applyTilt(face, shadow, direction)
    onEvent({ type: 'dpad', direction, phase: 'down' })
    startRepeat(direction)
  }

  const releaseNow = () => {
    if (!active) {
      clearTilt(face, shadow)
      return
    }
    const direction = active
    active = null
    pointerId = null
    clearRepeat()
    clearTilt(face, shadow)
    onEvent({ type: 'dpad', direction, phase: 'up' })
  }

  const release = () => {
    if (!active) return
    clearReleaseTimer()
    const elapsed = performance.now() - pressedAt
    if (elapsed < minPressMs) {
      releaseTimer = window.setTimeout(releaseNow, minPressMs - elapsed)
      return
    }
    releaseNow()
  }

  const onPointerDown = (ev: PointerEvent) => {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return
    const direction = directionFromPoint(
      hitTarget,
      ev.clientX,
      ev.clientY,
      deadZone,
    )
    pointerId = ev.pointerId
    hitTarget.setPointerCapture(ev.pointerId)
    engage(direction)
    ev.preventDefault()
  }

  const onPointerMove = (ev: PointerEvent) => {
    if (pointerId !== ev.pointerId || active === null) return
    // 仍按住时允许滑向其它方向；松手过程中的 move 忽略
    if (releaseTimer !== null) return
    const direction = directionFromPoint(
      hitTarget,
      ev.clientX,
      ev.clientY,
      deadZone,
    )
    engage(direction)
  }

  const onPointerUp = (ev: PointerEvent) => {
    if (pointerId !== null && ev.pointerId !== pointerId) return
    pointerId = null
    release()
  }

  hitTarget.addEventListener('pointerdown', onPointerDown)
  hitTarget.addEventListener('pointermove', onPointerMove)
  hitTarget.addEventListener('pointerup', onPointerUp)
  hitTarget.addEventListener('pointercancel', onPointerUp)
  hitTarget.addEventListener('lostpointercapture', onPointerUp)

  return {
    press(direction) {
      engage(direction)
    },
    release,
    destroy() {
      clearReleaseTimer()
      releaseNow()
      hitTarget.removeEventListener('pointerdown', onPointerDown)
      hitTarget.removeEventListener('pointermove', onPointerMove)
      hitTarget.removeEventListener('pointerup', onPointerUp)
      hitTarget.removeEventListener('pointercancel', onPointerUp)
      hitTarget.removeEventListener('lostpointercapture', onPointerUp)
      hitTarget.classList.remove('control-hit')
      hitTarget.style.touchAction = ''
      face.classList.remove('control-face', 'control-face--dpad')
      shadow.classList.remove('control-shadow', 'control-shadow--dpad')
      clearTilt(face, shadow)
    },
  }
}
