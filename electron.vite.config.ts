import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': resolve('src/shared') },
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer'),
        '@shared': resolve('src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          editor: resolve('src/renderer/editor.html'),
          settings: resolve('src/renderer/settings.html'),
          firstRun: resolve('src/renderer/first-run.html'),
          hud: resolve('src/renderer/hud.html'),
          history: resolve('src/renderer/history.html'),
          selection: resolve('src/renderer/selection.html'),
          recordingControls: resolve('src/renderer/recording-controls.html'),
          recordingEffects: resolve('src/renderer/recording-effects.html'),
          recordingStage: resolve('src/renderer/recording-stage.html'),
          recordingWindowPicker: resolve('src/renderer/recording-window-picker.html'),
          recordingRegionOutline: resolve('src/renderer/recording-region-outline.html'),
          webcam: resolve('src/renderer/webcam.html'),
        },
      },
    },
  },
});
