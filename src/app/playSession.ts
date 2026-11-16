import { FOCUS_TRANSITION_MS } from '../gameboy/layout'
import type { GameboyStageHandle } from '../components/GameboyStage'
import type { GameMeta } from './games'
import type { ScreenAppHandle } from './screen/ScreenApp'

const MIN_LOADING_MS = 450
const FAKE_PROGRESS_CAP = 90
// 先播放一段放大动画，再切到 loading，减少突兀感
const LOADING_SWITCH_DELAY_MS = 220
// 缩小时，延后一点再切回 menu，避免屏幕内容立刻跳变
const MENU_RETURN_DELAY_MS = 220
export const EXIT_MESSAGE_TYPE = 'my-games:exit'

type PlaySessionOptions = {
  stage: GameboyStageHandle
  screen: ScreenAppHandle
}

export type PlaySessionHandle = {
  start: (game: GameMeta) => void
  retry: () => void
  exit: () => void
  destroy: () => void
}

/**
 * 编排 zoom / loading / iframe / 返回。
 */
export function createPlaySession(
  options: PlaySessionOptions,
): PlaySessionHandle {
  const { stage, screen } = options
  let current: GameMeta | null = null
  let generation = 0
  let fakeTimer: number | null = null
  let exiting = false
  let unbindIframeKeys: (() => void) | null = null

  const clearFake = () => {
    if (fakeTimer !== null) {
      window.clearInterval(fakeTimer)
      fakeTimer = null
    }
  }

  const clearIframeKeys = () => {
    unbindIframeKeys?.()
    unbindIframeKeys = null
  }

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms)
    })

  const tuneGameFrameRendering = (iframe: HTMLIFrameElement) => {
    try {
      const doc = iframe.contentDocument
      if (!doc) return

      const styleId = 'my-games-pixel-rendering'
      if (!doc.getElementById(styleId)) {
        const style = doc.createElement('style')
        style.id = styleId
        style.textContent = `
html, body, #canvas, canvas {
  image-rendering: pixelated !important;
  image-rendering: crisp-edges !important;
}
`
        doc.head?.append(style)
      }

      const canvas = doc.getElementById('canvas') as HTMLCanvasElement | null
      if (canvas) {
        canvas.style.imageRendering = 'pixelated'
      }
    } catch {
      // cross-origin 或访问受限时忽略
    }
  }

  const waitFrameLoad = (iframe: HTMLIFrameElement, gen: number) =>
    new Promise<'ok' | 'error'>((resolve) => {
      const onLoad = () => {
        cleanup()
        resolve('ok')
      }
      const onError = () => {
        cleanup()
        resolve('error')
      }
      const cleanup = () => {
        iframe.removeEventListener('load', onLoad)
        iframe.removeEventListener('error', onError)
      }
      iframe.addEventListener('load', onLoad)
      iframe.addEventListener('error', onError)

      // 保险：若已完成（缓存）
      window.setTimeout(() => {
        if (gen !== generation) return
        try {
          const doc = iframe.contentDocument
          if (doc && doc.readyState === 'complete') {
            cleanup()
            resolve('ok')
          }
        } catch {
          /* cross-origin：等 load 事件 */
        }
      }, 0)
    })

  const bindIframeExitKeys = (iframe: HTMLIFrameElement, gen: number) => {
    const onKey = (ev: KeyboardEvent) => {
      if (gen !== generation) return
      if (ev.key === 'Escape' || ev.key === 'x' || ev.key === 'X') {
        ev.preventDefault()
        exit()
      }
    }
    try {
      iframe.contentWindow?.addEventListener('keydown', onKey)
      return () => {
        try {
          iframe.contentWindow?.removeEventListener('keydown', onKey)
        } catch {
          /* ignore */
        }
      }
    } catch {
      return () => {}
    }
  }

  const onMessage = (ev: MessageEvent) => {
    const data = ev.data
    if (
      data === EXIT_MESSAGE_TYPE ||
      (data && typeof data === 'object' && data.type === EXIT_MESSAGE_TYPE)
    ) {
      exit()
    }
  }

  window.addEventListener('message', onMessage)

  const runLoad = async (game: GameMeta) => {
    const gen = ++generation
    exiting = false
    current = game
    clearFake()
    clearIframeKeys()

    stage.setFocusMode(true)
    await wait(LOADING_SWITCH_DELAY_MS)
    if (gen !== generation || exiting) return
    screen.showLoading(game)

    let progress = 0
    screen.setLoadProgress(progress)
    fakeTimer = window.setInterval(() => {
      if (gen !== generation) return
      progress = Math.min(FAKE_PROGRESS_CAP, progress + 7)
      screen.setLoadProgress(progress)
    }, 120)

    const startedAt = performance.now()
    const iframe = screen.mountGameFrame(game.entry)

    const [loadResult] = await Promise.all([
      waitFrameLoad(iframe, gen),
      wait(FOCUS_TRANSITION_MS),
    ])

    const elapsed = performance.now() - startedAt
    if (elapsed < MIN_LOADING_MS) {
      await wait(MIN_LOADING_MS - elapsed)
    }

    if (gen !== generation || exiting) return

    clearFake()

    if (loadResult === 'error') {
      screen.showLoadError(game)
      return
    }

    tuneGameFrameRendering(iframe)

    // 同源占位页若 404，部分浏览器仍 fire load；探测标题/内容
    try {
      const doc = iframe.contentDocument
      if (doc) {
        const text = doc.body?.innerText ?? ''
        if (/404|cannot get|not found/i.test(text) && text.length < 80) {
          screen.showLoadError(game)
          return
        }
      }
    } catch {
      /* ignore */
    }

    screen.setLoadProgress(100)
    await wait(120)
    if (gen !== generation || exiting) return

    screen.showPlaying()
    unbindIframeKeys = bindIframeExitKeys(iframe, gen)
    iframe.focus()
  }

  const start = (game: GameMeta) => {
    void runLoad(game)
  }

  const exit = () => {
    if (exiting) return
    const phase = screen.getPhase()
    if (
      phase !== 'loading' &&
      phase !== 'load-error' &&
      phase !== 'playing'
    ) {
      return
    }
    exiting = true
    generation += 1
    clearFake()
    clearIframeKeys()
    stage.setFocusMode(false)
    window.setTimeout(() => {
      if (!exiting) return
      screen.returnToMenu()
    }, MENU_RETURN_DELAY_MS)
    window.setTimeout(() => {
      exiting = false
    }, FOCUS_TRANSITION_MS)
  }

  const retry = () => {
    if (!current) return
    void runLoad(current)
  }

  return {
    start,
    retry,
    exit,
    destroy() {
      generation += 1
      clearFake()
      clearIframeKeys()
      window.removeEventListener('message', onMessage)
    },
  }
}
