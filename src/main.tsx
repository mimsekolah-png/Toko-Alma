import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Daftarkan Service Worker agar aset HTML, CSS, JS di-cache di browser HP & Laptop
// Membuat aplikasi selalu siap dinyalakan seketika (0 detik)
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
