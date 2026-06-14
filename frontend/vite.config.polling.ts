// Temp override: run Vite with polling so it doesn't consume inotify instances
// (host inotify limit saturated). Use: npm run dev -- --config vite.config.polling.ts
import base from './vite.config'
import { mergeConfig, defineConfig } from 'vite'

export default mergeConfig(
  base,
  defineConfig({
    server: {
      watch: { usePolling: true, interval: 300 },
    },
  }),
)