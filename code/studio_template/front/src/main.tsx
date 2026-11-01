import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

// StrictMode 會讓 effect 跑兩次（掛載 → 清理 → 再掛載），BusyButton 那類用 ref 記狀態的元件就是靠它抓出 bug 的，別拿掉。
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
