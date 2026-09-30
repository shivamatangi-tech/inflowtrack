/**
 * ============================================================================
 * File: vite.config.ts
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Configures the Vite build tool and frontend bundler for the React +
 *   TypeScript + Tailwind CSS v4 single-page web application.
 *
 * Key Responsibilities:
 *   1. Enables the official React plugin (@vitejs/plugin-react) and Tailwind
 *      CSS v4 plugin (@tailwindcss/vite).
 *   2. Configures the '@' path alias to resolve to the project root.
 *   3. Configures port 3000 and HMR settings for seamless development inside
 *      the full-stack Express + Vite server (server.ts).
 * ============================================================================
 */

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
