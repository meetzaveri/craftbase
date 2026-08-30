import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
    plugins: [svgr(), react(), tsconfigPaths()],
    server: {
        host: true,
        allowedHosts: [
            '10.106.71.95',
            'a28a-2409-40c1-546e-411b-3105-339d-1dc9-cd70.ngrok-free.app',
        ],
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './src/setupTests.js',
    },
})
