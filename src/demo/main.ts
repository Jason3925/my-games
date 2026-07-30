import '../style.css'

const UPCOMING_BLOCKS = [
  'D-Pad Tilt',
  'A / B 按下反馈',
  'Option（Select / Start）按下反馈',
  'Screen 聚焦预览',
  'NES.css 样例',
  '合成预览（静态机身）',
] as const

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) {
  throw new Error('#app not found')
}

root.innerHTML = `
  <main class="shell">
    <p class="eyebrow">Demo 实验室</p>
    <h1>组件预览</h1>
    <p class="lede">不进完整状态机，单独验收交互与视觉。以下区块将在后续步骤接入。</p>
    <h2>即将测试的区块</h2>
    <ul class="block-list">
      ${UPCOMING_BLOCKS.map((label) => `<li>${label}</li>`).join('')}
    </ul>
    <p class="meta"><a href="/">← 返回正式页</a></p>
  </main>
`
