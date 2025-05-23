import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    basicSsl()
  ],
  server: {
    https: true,
  },
  base: '/webxr-linear-algebra-react-app/',
})
