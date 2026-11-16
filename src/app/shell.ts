import { mountGameboyStage } from '../components/GameboyStage'
import { createPlaySession } from './playSession'
import { mountScreenApp } from './screen/ScreenApp'

/** 正式入口：全景机身 + boot/menu + zoom/iframe 游玩环。 */
export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <main class="page page--stage">
      <div class="stage-host" data-host="gameboy"></div>
    </main>
  `

  const host = root.querySelector<HTMLElement>('[data-host="gameboy"]')
  if (!host) {
    throw new Error('stage host not found')
  }

  const screenRoot = document.createElement('div')
  let session: ReturnType<typeof createPlaySession> | null = null

  const screen = mountScreenApp(screenRoot, {
    onRequestStart(game) {
      session?.start(game)
    },
    onRequestExit() {
      session?.exit()
    },
    onRequestRetry() {
      session?.retry()
    },
  })

  const stage = mountGameboyStage(host, {
    interactive: true,
    bindKeyboard: true,
    screenContent: screenRoot,
    onControl: (event) => screen.handleControl(event),
  })

  session = createPlaySession({ stage, screen })
}
