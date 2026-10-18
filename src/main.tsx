import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { startSync } from './sync';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

startSync();

// Offline-stöd. Bara i den byggda appen, så att inget cachas medan du utvecklar.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// Be webbläsaren att inte rensa datan automatiskt när det blir ont om lagringsutrymme.
navigator.storage?.persist?.();
