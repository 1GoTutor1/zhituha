import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const AntonDemo = lazy(() => import('./AntonDemo.tsx'))

const isAntonDemo = new URLSearchParams(window.location.search).has('anton-demo')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAntonDemo ? <Suspense fallback={null}><AntonDemo /></Suspense> : <App />}
  </StrictMode>,
)
