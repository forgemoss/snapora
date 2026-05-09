import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SelectionOverlay } from './components/Selection';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
createRoot(container).render(
  <StrictMode>
    <SelectionOverlay />
  </StrictMode>,
);
