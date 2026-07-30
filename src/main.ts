import './style.css'
import { mountApp } from './app/shell'

const root = document.querySelector<HTMLDivElement>('#app')
if (!root) {
  throw new Error('#app not found')
}

mountApp(root)
