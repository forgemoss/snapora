import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RecordingControls } from './components/recording/RecordingControls';
import './styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');
createRoot(container).render(
  <StrictMode>
    <RecordingControls />
  </StrictMode>,
);
