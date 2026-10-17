import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './': shampoe.com serves this build at /trades/app/ (prefix stripped), so every asset URL
// must be relative.
export default defineConfig({
  base: './',
  plugins: [react()],
})
