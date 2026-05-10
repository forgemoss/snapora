import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Webcam } from './components/recording/Webcam';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
createRoot(container).render(
  <StrictMode>
    <Webcam />
  </StrictMode>,
);
