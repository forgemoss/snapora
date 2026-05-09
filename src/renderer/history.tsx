import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { History } from './components/History';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
createRoot(container).render(
  <StrictMode>
    <History />
  </StrictMode>,
);
