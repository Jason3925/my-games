import type { DPadHandle } from './DPad'
import type { PressButtonHandle } from './PressButton'
import type { ButtonId, PadDirection } from './types'

type KeyboardOptions = {
  dpad: DPadHandle
  buttons: Record<ButtonId, PressButtonHandle>
}

const DPAD_KEYS: Record<string, PadDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/** 与步骤文案一致：↑↓←→、Z/Space→A、Enter→Start、Esc/X→B。 */
export function bindControlKeyboard(options: KeyboardOptions): () => void {
  const { dpad, buttons } = options
  const held = new Set<string>()

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.repeat) return
    if (isTypingTarget(ev.target)) return

    const dir = DPAD_KEYS[ev.key]
    if (dir) {
      ev.preventDefault()
      held.add(ev.key)
      dpad.press(dir)
      return
    }

    if (ev.key === 'Enter') {
      ev.preventDefault()
      held.add(ev.key)
      buttons.start.press()
      return
    }

    if (ev.key === 'z' || ev.key === 'Z' || ev.key === ' ') {
      ev.preventDefault()
      held.add(ev.key)
      buttons.a.press()
      return
    }

    if (ev.key === 'Escape' || ev.key === 'x' || ev.key === 'X') {
      ev.preventDefault()
      held.add(ev.key)
      buttons.b.press()
    }
  }

  const onKeyUp = (ev: KeyboardEvent) => {
    if (!held.has(ev.key)) return
    held.delete(ev.key)

    const dir = DPAD_KEYS[ev.key]
    if (dir) {
      ev.preventDefault()
      // 若仍按着其它方向键，切到仍按住的方向
      const still = [...held].map((k) => DPAD_KEYS[k]).find(Boolean)
      if (still) dpad.press(still)
      else dpad.release()
      return
    }

    if (ev.key === 'Enter') {
      ev.preventDefault()
      buttons.start.release()
      return
    }

    if (ev.key === 'z' || ev.key === 'Z' || ev.key === ' ') {
      ev.preventDefault()
      buttons.a.release()
      return
    }

    if (ev.key === 'Escape' || ev.key === 'x' || ev.key === 'X') {
      ev.preventDefault()
      buttons.b.release()
    }
  }

  const onBlur = () => {
    held.clear()
    dpad.release()
    for (const btn of Object.values(buttons)) btn.release()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
    onBlur()
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}
