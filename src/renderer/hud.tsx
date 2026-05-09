import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Hud } from './components/Hud';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
createRoot(container).render(
  <StrictMode>
    <Hud />
  </StrictMode>,
);
