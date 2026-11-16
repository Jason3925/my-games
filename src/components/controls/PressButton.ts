import type { ButtonId, ControlListener } from './types'

export type PressButtonHandle = {
  press: () => void
  release: () => void
  destroy: () => void
}

type PressButtonOptions = {
  id: ButtonId
  face: HTMLElement
  shadow: HTMLElement
  hitTarget?: HTMLElement
  onEvent: ControlListener
  variant: 'action' | 'option'
  /** 轻点时按下态最短展示 */
  minPressMs?: number
}

/** A/B 或 Select/Start：按下下沉 + 阴影收拢。 */
export function mountPressButton(options: PressButtonOptions): PressButtonHandle {
  const {
    id,
    face,
    shadow,
    hitTarget = face,
    onEvent,
    variant,
    minPressMs = 100,
  } = options

  face.classList.add('control-face', `control-face--${variant}`)
  shadow.classList.add('control-shadow', `control-shadow--${variant}`)
  hitTarget.classList.add('control-hit')
  hitTarget.style.touchAction = 'none'

  let pressed = false
  let pointerId: number | null = null
  let pressedAt = 0
  let releaseTimer: number | null = null

  const setPressed = (next: boolean) => {
    face.classList.toggle('is-pressed', next)
    shadow.classList.toggle('is-pressed', next)
  }

  const clearReleaseTimer = () => {
    if (releaseTimer !== null) {
      window.clearTimeout(releaseTimer)
      releaseTimer = null
    }
  }

  const press = () => {
    clearReleaseTimer()
    if (pressed) return
    pressed = true
    pressedAt = performance.now()
    setPressed(true)
    onEvent({ type: 'button', id, phase: 'down' })
  }

  const releaseNow = () => {
    if (!pressed) return
    pressed = false
    pointerId = null
    setPressed(false)
    onEvent({ type: 'button', id, phase: 'up' })
  }

  const release = () => {
    if (!pressed) return
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
    pointerId = ev.pointerId
    hitTarget.setPointerCapture(ev.pointerId)
    press()
    ev.preventDefault()
  }

  const onPointerUp = (ev: PointerEvent) => {
    if (pointerId !== null && ev.pointerId !== pointerId) return
    pointerId = null
    release()
  }

  hitTarget.addEventListener('pointerdown', onPointerDown)
  hitTarget.addEventListener('pointerup', onPointerUp)
  hitTarget.addEventListener('pointercancel', onPointerUp)
  hitTarget.addEventListener('lostpointercapture', onPointerUp)

  return {
    press,
    release,
    destroy() {
      clearReleaseTimer()
      releaseNow()
      hitTarget.removeEventListener('pointerdown', onPointerDown)
      hitTarget.removeEventListener('pointerup', onPointerUp)
      hitTarget.removeEventListener('pointercancel', onPointerUp)
      hitTarget.removeEventListener('lostpointercapture', onPointerUp)
      hitTarget.classList.remove('control-hit')
      hitTarget.style.touchAction = ''
      face.classList.remove(
        'control-face',
        `control-face--${variant}`,
        'is-pressed',
      )
      shadow.classList.remove(
        'control-shadow',
        `control-shadow--${variant}`,
        'is-pressed',
      )
    },
  }
}
