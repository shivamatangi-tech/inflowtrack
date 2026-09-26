/**
 * ============================================================================
 * File: src/main.tsx
 * Application: inflotrack — Track Save Grow
 * Purpose:
 *   Client-side React DOM entry point.
 *
 * Key Responsibilities:
 *   1. Imports global Tailwind CSS styles (`./index.css`).
 *   2. Mounts the root `<App />` component inside React `<StrictMode>` into
 *      the `#root` DOM container defined in `index.html`.
 * ============================================================================
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
