import { defineConfig } from 'vite'
import * as path from 'path';
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // eslint-disable-next-line no-undef
    alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }]
  }
})
