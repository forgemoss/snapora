import { BrowserWindow, clipboard, dialog, ipcMain, nativeImage } from 'electron';
import { copyFile, unlink } from 'node:fs/promises';
import { basename } from 'node:path';
import logger from '@main/logger';
import { showEditorWithImage } from '@main/windows/editor';
import { dismissHud, getHudCurrentImage, showHudWithImage } from '@main/windows/hud';
import { IPC } from '@shared/ipc';

export function registerHudHandlers(): void {
  ipcMain.handle(IPC.hud.requestCurrent, () => getHudCurrentImage().url);

  ipcMain.handle(IPC.hud.dismiss, () => {
    logger.info('hud: dismiss');
    dismissHud();
  });

  ipcMain.handle(IPC.hud.closeAndDelete, async () => {
    const { filePath } = getHudCurrentImage();
    logger.info('hud: close + delete', { filePath });
    dismissHud();
    if (filePath) {
      try {
        await unlink(filePath);
        logger.info('hud: deleted', { filePath });
      } catch (err) {
        logger.warn('hud: delete failed', err);
      }
    }
  });

  ipcMain.handle(IPC.hud.copy, () => {
    const { filePath } = getHudCurrentImage();
    logger.info('hud: copy', { filePath });
    if (!filePath) return;
    const img = nativeImage.createFromPath(filePath);
    if (!img.isEmpty()) clipboard.writeImage(img);
    dismissHud();
  });

  ipcMain.handle(IPC.hud.saveAs, async () => {
    const { filePath } = getHudCurrentImage();
    logger.info('hud: saveAs', { filePath });
    if (!filePath) return { saved: false, path: null };
    const focused = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(focused ?? new BrowserWindow({ show: false }), {
      defaultPath: basename(filePath),
      filters: [{ name: 'PNG', extensions: ['png'] }],
    });
    if (result.canceled || !result.filePath) return { saved: false, path: null };
    await copyFile(filePath, result.filePath);
    logger.info('hud: saved as', { from: filePath, to: result.filePath });
    dismissHud();
    return { saved: true, path: result.filePath };
  });

  ipcMain.handle(IPC.hud.openInEditor, () => {
    const { filePath } = getHudCurrentImage();
    logger.info('hud: open in editor', { filePath });
    if (!filePath) return;
    showEditorWithImage(filePath);
    dismissHud();
  });

  // Re-export for explicit symbol use elsewhere
  void showHudWithImage;
}
