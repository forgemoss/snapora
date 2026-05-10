import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WindowPicker } from './components/recording/WindowPicker';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
createRoot(container).render(
  <StrictMode>
    <WindowPicker />
  </StrictMode>,
);
