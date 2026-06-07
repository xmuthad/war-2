import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { useGameStore } from './store/gameStore'
import './index.css'

// Expose game store for E2E testing
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__gameStore__ = useGameStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
