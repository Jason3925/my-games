import '../style.css'
import { mountGameboyStage } from '../components/GameboyStage'
import type { ControlEvent } from '../components/controls/types'
import { createPlaySession } from '../app/playSession'
import { mountScreenApp } from '../app/screen/ScreenApp'

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) {
  throw new Error('#app not found')
}

root.innerHTML = `
  <main class="page page--demo">
    <header class="demo-header">
      <p class="eyebrow">MY-GAMES / COMPONENT LAB</p>
      <h1>组件实验室</h1>
      <p class="lede">测试机身控件、屏幕流程与聚焦预览。完整游玩环也可在本页用 A/Start 走一遍；独立路由 <code>/demo/</code>。</p>
    </header>

    <div class="demo-layout">
      <section class="demo-stage-panel" aria-label="交互舞台">
        <div class="stage-host stage-host--demo" data-host="compose"></div>
      </section>

      <aside class="demo-side">
        <section class="demo-block" aria-labelledby="focus-title">
          <h2 id="focus-title">Screen Focus Preview</h2>
          <p class="lede">一键模拟开始游戏后的蒙版变暗与屏幕放大（不加载 iframe）。</p>
          <div class="demo-focus-actions">
            <button type="button" class="demo-clear" data-action="focus-on">预览聚焦</button>
            <button type="button" class="demo-clear" data-action="focus-off">恢复全景</button>
          </div>
        </section>

        <section class="demo-block" aria-labelledby="dpad-title">
          <h2 id="dpad-title">D-Pad · 3D Tilt</h2>
          <p class="lede">点击或按住十字键四个方向。正式流程里 ↑↓ 切换菜单。</p>
        </section>

        <section class="demo-block" aria-labelledby="action-title">
          <h2 id="action-title">Action / Option</h2>
          <p class="lede">A / Start 开始游戏；游玩中 B / Esc 返回；加载失败时 A 重试、B 返回。</p>
        </section>

        <section class="demo-block" aria-labelledby="nes-title">
          <h2 id="nes-title">NES.css On Screen</h2>
          <p class="lede">Boot → Menu → Loading → iframe 占位页均在绿屏内。</p>
          <div class="demo-nes-sample screen-app">
            <div class="screen-shell">
              <p class="screen-boot__title">NES SAMPLE</p>
              <progress class="nes-progress is-success screen-boot__bar" value="70" max="100"></progress>
              <p class="screen-menu__footer">PROGRESS / LIST / DIALOG</p>
            </div>
          </div>
        </section>

        <section class="demo-block" aria-labelledby="log-title">
          <div class="demo-log-head">
            <h2 id="log-title">事件日志</h2>
            <button type="button" class="demo-clear" data-action="clear-log">清空</button>
          </div>
          <ol class="demo-log" data-log aria-live="polite"></ol>
        </section>

        <p class="meta"><a href="/">← 返回正式页</a></p>
      </aside>
    </div>
  </main>
`

const host = root.querySelector<HTMLElement>('[data-host="compose"]')
const logEl = root.querySelector<HTMLOListElement>('[data-log]')
const clearBtn = root.querySelector<HTMLButtonElement>('[data-action="clear-log"]')
const focusOnBtn = root.querySelector<HTMLButtonElement>('[data-action="focus-on"]')
const focusOffBtn = root.querySelector<HTMLButtonElement>('[data-action="focus-off"]')
if (!host || !logEl || !clearBtn || !focusOnBtn || !focusOffBtn) {
  throw new Error('demo hosts not found')
}

const hostEl = host
const logList = logEl

const MAX_LOG = 80

function formatEvent(event: ControlEvent): string {
  if (event.type === 'dpad') {
    return `dpad ${event.direction} (${event.phase})`
  }
  return `button ${event.id} ${event.phase}`
}

function appendLog(event: ControlEvent): void {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const item = document.createElement('li')
  item.textContent = `[${time}] ${formatEvent(event)}`
  logList.prepend(item)
  while (logList.children.length > MAX_LOG) {
    logList.lastElementChild?.remove()
  }
}

function appendNote(text: string): void {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  const item = document.createElement('li')
  item.textContent = `[${time}] ${text}`
  logList.prepend(item)
}

clearBtn.addEventListener('click', () => {
  logList.replaceChildren()
})

const screenRoot = document.createElement('div')
let session: ReturnType<typeof createPlaySession> | null = null

const screen = mountScreenApp(screenRoot, {
  onRequestStart(game) {
    appendNote(`start ${game.id}`)
    session?.start(game)
  },
  onRequestExit() {
    appendNote('exit')
    session?.exit()
  },
  onRequestRetry() {
    appendNote('retry')
    session?.retry()
  },
})

const stage = mountGameboyStage(hostEl, {
  interactive: true,
  bindKeyboard: true,
  screenContent: screenRoot,
  onControl: (event) => {
    appendLog(event)
    screen.handleControl(event)
  },
})

session = createPlaySession({ stage, screen })

focusOnBtn.addEventListener('click', () => {
  stage.setFocusMode(true)
  appendNote('focus preview on')
})

focusOffBtn.addEventListener('click', () => {
  stage.setFocusMode(false)
  appendNote('focus preview off')
})
