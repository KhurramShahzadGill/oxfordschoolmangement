import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Amounts are typed, never scrolled. Stop the mouse wheel from changing a
// focused number input (blur it so the page scrolls instead), and stop the
// Up/Down arrow keys from incrementing/decrementing the value.
const isNumberInput = (el) => el && el.tagName === 'INPUT' && el.type === 'number';
document.addEventListener('wheel', () => {
  if (isNumberInput(document.activeElement)) document.activeElement.blur();
}, { passive: true });
document.addEventListener('keydown', (e) => {
  if (isNumberInput(document.activeElement) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
