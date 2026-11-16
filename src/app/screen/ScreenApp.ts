import type { ControlEvent } from '../../components/controls/types'
import { loadGamesManifest, type GameMeta } from '../games'
import './screen.css'

export type ScreenPhase =
  | 'boot'
  | 'menu'
  | 'loading'
  | 'load-error'
  | 'playing'

export type ScreenAppHandle = {
  handleControl: (event: ControlEvent) => void
  getPhase: () => ScreenPhase
  getSelectedGame: () => GameMeta | null
  /** 进入 loading UI（保留菜单选中项） */
  showLoading: (game: GameMeta) => void
  setLoadProgress: (value: number) => void
  showLoadError: (game: GameMeta) => void
  /** 挂载/更新 iframe；返回 iframe 元素 */
  mountGameFrame: (entry: string) => HTMLIFrameElement
  showPlaying: () => void
  /** 销毁 iframe，回到 menu（保留 selected） */
  returnToMenu: () => void
  destroy: () => void
}

type ScreenAppOptions = {
  onRequestStart?: (game: GameMeta) => void
  onRequestExit?: () => void
  onRequestRetry?: () => void
  bootDurationMs?: number
}

/**
 * 屏幕内容层：boot → menu → loading / load-error → playing。
 */
export function mountScreenApp(
  root: HTMLElement,
  options: ScreenAppOptions = {},
): ScreenAppHandle {
  const bootDurationMs = options.bootDurationMs ?? 2000
  let phase: ScreenPhase = 'boot'
  let games: GameMeta[] = []
  let selected = 0
  let loadError: string | null = null
  let activeGame: GameMeta | null = null
  let loadProgress = 0
  let bootProgress = 0
  let destroyed = false
  let bootTimer: number | null = null
  let bootRaf: number | null = null
  let flashTimer: number | null = null
  let iframeEl: HTMLIFrameElement | null = null

  root.classList.add('screen-app')
  root.innerHTML = ''

  const shell = document.createElement('div')
  shell.className = 'screen-shell nes-ui'
  root.append(shell)

  const frameHost = document.createElement('div')
  frameHost.className = 'screen-frame-host'
  frameHost.hidden = true
  root.append(frameHost)

  const clearBootTimers = () => {
    if (bootTimer !== null) {
      window.clearTimeout(bootTimer)
      bootTimer = null
    }
    if (bootRaf !== null) {
      window.cancelAnimationFrame(bootRaf)
      bootRaf = null
    }
  }

  const destroyFrame = () => {
    frameHost.replaceChildren()
    frameHost.hidden = true
    iframeEl = null
  }

  const enterMenu = () => {
    clearBootTimers()
    phase = 'menu'
    activeGame = null
    loadProgress = 0
    destroyFrame()
    shell.hidden = false
    render()
  }

  const flashMenu = () => {
    shell.classList.add('is-flash')
    if (flashTimer !== null) window.clearTimeout(flashTimer)
    flashTimer = window.setTimeout(() => {
      shell.classList.remove('is-flash')
    }, 120)
  }

  const renderBoot = () => {
    shell.innerHTML = `
      <div class="screen-boot">
        <p class="screen-boot__title">MY-GAMES OS</p>
        <p class="screen-boot__ver">v0.1</p>
        <p class="screen-boot__status">BOOTING...</p>
        <progress class="nes-progress is-success screen-boot__bar" value="${Math.round(bootProgress)}" max="100"></progress>
        <p class="screen-boot__hint">A / START SKIP</p>
      </div>
    `
  }

  const renderMenu = () => {
    if (loadError) {
      shell.innerHTML = `
        <div class="screen-menu screen-menu--error">
          <p class="screen-menu__title">MENU ERROR</p>
          <p class="screen-menu__error">${loadError}</p>
          <p class="screen-menu__footer">PRESS B TO RETRY</p>
        </div>
      `
      return
    }

    if (games.length === 0) {
      shell.innerHTML = `
        <div class="screen-menu">
          <p class="screen-menu__title">SELECT GAME</p>
          <p class="screen-menu__empty">NO GAMES FOUND</p>
          <p class="screen-menu__footer">↑↓ MOVE    A START</p>
        </div>
      `
      return
    }

    const game = games[selected] ?? games[0]
    const list = games
      .map((item, index) => {
        const active = index === selected
        return `<li class="screen-menu__item${active ? ' is-active' : ''}">${active ? '▸ ' : '  '}${escapeHtml(item.title)}</li>`
      })
      .join('')

    shell.innerHTML = `
      <div class="screen-menu">
        <p class="screen-menu__title">SELECT GAME</p>
        <div class="screen-menu__body">
          <ul class="screen-menu__list">${list}</ul>
          <div class="screen-menu__cover" data-cover>
            <img src="${escapeAttr(game.cover)}" alt="" draggable="false" />
            <span class="screen-menu__cover-fallback" hidden>${escapeHtml(game.title.slice(0, 1))}</span>
          </div>
        </div>
        <p class="screen-menu__footer">↑↓ MOVE    A START</p>
      </div>
    `

    const img = shell.querySelector<HTMLImageElement>('.screen-menu__cover img')
    const fallback = shell.querySelector<HTMLElement>('.screen-menu__cover-fallback')
    if (img && fallback) {
      const showFallback = () => {
        img.hidden = true
        fallback.hidden = false
      }
      img.addEventListener('error', showFallback, { once: true })
      if (img.complete && img.naturalWidth === 0) showFallback()
    }
  }

  const renderLoading = () => {
    const title = activeGame?.title ?? 'GAME'
    shell.innerHTML = `
      <div class="screen-loading">
        <p class="screen-loading__label">LOADING</p>
        <p class="screen-loading__title">${escapeHtml(title)}</p>
        <progress class="nes-progress is-success screen-boot__bar" value="${Math.round(loadProgress)}" max="100"></progress>
        <p class="screen-loading__hint">PLEASE WAIT</p>
      </div>
    `
  }

  const renderLoadError = () => {
    const title = activeGame?.title ?? 'GAME'
    shell.innerHTML = `
      <div class="screen-loading screen-loading--error">
        <p class="screen-loading__label">LOAD FAILED</p>
        <p class="screen-loading__title">${escapeHtml(title)}</p>
        <p class="screen-menu__footer">A RETRY    B BACK</p>
      </div>
    `
  }

  const render = () => {
    if (destroyed) return
    if (phase === 'boot') renderBoot()
    else if (phase === 'menu') renderMenu()
    else if (phase === 'loading') renderLoading()
    else if (phase === 'load-error') renderLoadError()
    else if (phase === 'playing') {
      /* iframe 可见，shell 可隐藏 */
    }
  }

  const startBoot = () => {
    phase = 'boot'
    bootProgress = 0
    shell.hidden = false
    destroyFrame()
    render()
    const started = performance.now()
    const tick = (now: number) => {
      if (destroyed || phase !== 'boot') return
      bootProgress = Math.min(100, ((now - started) / bootDurationMs) * 100)
      renderBoot()
      if (bootProgress >= 100) {
        enterMenu()
        return
      }
      bootRaf = window.requestAnimationFrame(tick)
    }
    bootRaf = window.requestAnimationFrame(tick)
  }

  const retryManifest = async () => {
    loadError = null
    try {
      const manifest = await loadGamesManifest()
      games = manifest.games
      selected = 0
    } catch (err) {
      loadError = 'LOAD FAILED'
      console.error(err)
    }
    enterMenu()
  }

  const handleControl = (event: ControlEvent) => {
    if (destroyed) return

    if (phase === 'boot') {
      if (
        event.type === 'button' &&
        event.phase === 'down' &&
        (event.id === 'a' || event.id === 'start')
      ) {
        enterMenu()
      }
      return
    }

    if (phase === 'loading') {
      // 加载中锁定输入（首期不做取消）
      return
    }

    if (phase === 'load-error') {
      if (event.type === 'button' && event.phase === 'down') {
        if (event.id === 'a' || event.id === 'start') {
          options.onRequestRetry?.()
        } else if (event.id === 'b') {
          options.onRequestExit?.()
        }
      }
      return
    }

    if (phase === 'playing') {
      if (
        event.type === 'button' &&
        event.phase === 'down' &&
        event.id === 'b'
      ) {
        options.onRequestExit?.()
      }
      return
    }

    // menu
    if (loadError) {
      if (
        event.type === 'button' &&
        event.phase === 'down' &&
        event.id === 'b'
      ) {
        void retryManifest()
      }
      return
    }

    if (event.type === 'dpad' && (event.phase === 'down' || event.phase === 'repeat')) {
      if (games.length === 0) return
      if (event.direction === 'up') {
        selected = (selected - 1 + games.length) % games.length
        render()
      } else if (event.direction === 'down') {
        selected = (selected + 1) % games.length
        render()
      }
      return
    }

    if (event.type === 'button' && event.phase === 'down') {
      if (event.id === 'a' || event.id === 'start') {
        const game = games[selected]
        if (game) options.onRequestStart?.(game)
        return
      }
      if (event.id === 'b') {
        flashMenu()
      }
    }
  }

  void (async () => {
    try {
      const manifest = await loadGamesManifest()
      if (destroyed) return
      games = manifest.games
    } catch (err) {
      console.error(err)
      loadError = 'LOAD FAILED'
    }
    if (!destroyed) startBoot()
  })()

  return {
    handleControl,
    getPhase: () => phase,
    getSelectedGame: () => games[selected] ?? null,
    showLoading(game) {
      activeGame = game
      phase = 'loading'
      loadProgress = 0
      shell.hidden = false
      frameHost.hidden = true
      render()
    },
    setLoadProgress(value) {
      loadProgress = Math.max(0, Math.min(100, value))
      if (phase === 'loading') renderLoading()
    },
    showLoadError(game) {
      activeGame = game
      phase = 'load-error'
      shell.hidden = false
      destroyFrame()
      render()
    },
    mountGameFrame(entry) {
      destroyFrame()
      const iframe = document.createElement('iframe')
      iframe.className = 'screen-game-frame'
      iframe.title = activeGame?.title ?? 'game'
      iframe.src = entry
      iframe.setAttribute('allow', 'gamepad *; fullscreen *')
      iframe.tabIndex = -1
      frameHost.append(iframe)
      iframeEl = iframe
      // loading 期间先挂载但隐藏，等 playing 再显示
      frameHost.hidden = true
      return iframe
    },
    showPlaying() {
      phase = 'playing'
      shell.hidden = true
      frameHost.hidden = false
      iframeEl?.focus()
    },
    returnToMenu() {
      enterMenu()
    },
    destroy() {
      destroyed = true
      clearBootTimers()
      if (flashTimer !== null) window.clearTimeout(flashTimer)
      destroyFrame()
      root.replaceChildren()
      root.classList.remove('screen-app')
    },
  }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replaceAll("'", '&#39;')
}
