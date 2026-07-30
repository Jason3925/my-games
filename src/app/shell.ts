/** 正式入口壳：步骤 0 仅占位，后续在此挂载状态机与 Gameboy 舞台。 */
export function mountApp(root: HTMLElement): void {
  root.innerHTML = `
    <main class="shell">
      <p class="eyebrow">my-games</p>
      <h1>像素掌机展柜</h1>
      <p class="lede">工程骨架已就绪。Gameboy 合成与交互将在后续步骤接入。</p>
      <p class="meta"><a href="/demo.html">打开 Demo 实验室 →</a></p>
    </main>
  `
}
