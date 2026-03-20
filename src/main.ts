import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import './styles/globals.scss'

import App from './App'

const rootEl = document.querySelector<HTMLDivElement>('#app')
if (!rootEl) throw new Error('Root element #app not found')

ReactDOM.createRoot(rootEl).render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(BrowserRouter, null, React.createElement(App)),
  ),
)
