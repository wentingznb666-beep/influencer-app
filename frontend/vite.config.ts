import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 监听 0.0.0.0，允许局域网通过本机 IP 访问
    /** 开发时把 /uploads 转到后端，避免 img 使用相对路径时落到 Vite 端口无静态文件。 */
    proxy: {
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
})
