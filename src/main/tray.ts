import { Menu, Tray, app, nativeImage, shell } from 'electron';
import { join } from 'node:path';
import logger from '@main/logger';
import { takeScreenshot } from '@main/capture/screenshot';
import { openEditorEmpty } from '@main/windows/editor';
import { showHudWithImage } from '@main/windows/hud';
import { getPreferences } from '@main/storage/prefs';
import type { CaptureMode } from '@shared/types';

let tray: Tray | null = null;

export function createTray(): Tray {
  const icon = nativeImage.createFromPath(join(__dirname, '../../resources/tray-icon.png'));
  const hasIcon = !icon.isEmpty();
  if (hasIcon) icon.setTemplateImage(true);

  tray = new Tray(hasIcon ? icon : nativeImage.createEmpty());
  if (!hasIcon) tray.setTitle('Snapora');
  tray.setToolTip('Snapora — capture, annotate, share');
  rebuildTrayMenu();
  logger.info('tray: created', { hasIcon });
  return tray;
}

export function rebuildTrayMenu(): void {
  if (!tray) return;
  const prefs = getPreferences();

  const captureItem = (label: string, mode: CaptureMode) => ({
    label,
    accelerator: prefs.hotkeys[mode],
    click: () => void runCapture(mode),
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'All-In-One',
      enabled: false, // v0.2 — single configurable post-capture pipeline
      sublabel: 'v0.2',
    },
    captureItem('Capture Area…', 'area'),
    { label: 'Capture Previous Area', enabled: false, sublabel: 'v0.2' },
    captureItem('Capture Fullscreen', 'fullscreen'),
    captureItem('Capture Window…', 'window'),
    { label: 'Scrolling Capture', enabled: false, sublabel: 'v0.2' },
    { label: 'Self-Timer', enabled: false, sublabel: 'v0.2' },
    { label: 'Capture Text (OCR)', enabled: false, sublabel: 'v0.5' },
    { label: 'Record Screen', enabled: false, sublabel: 'v0.4' },
    { type: 'separator' },
    { label: 'Hide Desktop Icons', enabled: false, sublabel: 'v0.2' },
    { type: 'separator' },
    { label: 'Open Editor', click: () => openEditorEmpty() },
    {
      label: 'Open from Clipboard',
      accelerator: 'CommandOrControl+V',
      enabled: false,
      sublabel: 'v0.2',
    },
    { label: 'Pin to the Screen…', enabled: false, sublabel: 'v0.5' },
    { type: 'separator' },
    { label: 'Capture History…', enabled: false, sublabel: 'v0.2' },
    { type: 'separator' },
    {
      label: 'About Snapora',
      click: () => void shell.openExternal('https://github.com/forgemoss/Snapora'),
    },
    { label: 'Check for Updates…', enabled: false, sublabel: 'v1.0' },
    { type: 'separator' },
    { label: 'Settings…', accelerator: 'CommandOrControl+,', enabled: false, sublabel: 'v0.1' },
    { label: `Snapora ${app.getVersion()}`, enabled: false },
    { label: 'Quit Snapora', accelerator: 'CommandOrControl+Q', role: 'quit' },
  ]);
  tray.setContextMenu(menu);
}

async function runCapture(mode: CaptureMode): Promise<void> {
  const prefs = getPreferences();
  try {
    const result = await takeScreenshot({
      mode,
      format: prefs.defaultFormat,
      copyToClipboard: prefs.autoCopyToClipboard,
      saveToDisk: true,
    });
    if (!result.cancelled && result.filePath) {
      showHudWithImage(result.filePath);
    }
  } catch (err) {
    logger.error('tray: capture failed', err);
  }
}
