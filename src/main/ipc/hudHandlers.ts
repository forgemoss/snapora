import { BrowserWindow, clipboard, dialog, ipcMain, nativeImage } from 'electron';
import { copyFile, unlink } from 'node:fs/promises';
import { basename } from 'node:path';
import logger from '@main/logger';
import { showEditorWithImage } from '@main/windows/editor';
import {
  dismissHud,
  findHudCard,
  getHudStack,
  removeHudCard,
  showHudWithImage,
} from '@main/windows/hud';
import { IPC } from '@shared/ipc';

export function registerHudHandlers(): void {
  ipcMain.handle(IPC.hud.requestStack, () => getHudStack());

  ipcMain.handle(IPC.hud.dismiss, () => {
    logger.info('hud: dismiss');
    dismissHud();
  });

  ipcMain.handle(IPC.hud.dismissCard, (_evt, id: number) => {
    logger.info('hud: dismiss card', { id });
    removeHudCard(id);
  });

  ipcMain.handle(IPC.hud.discardCard, async (_evt, id: number) => {
    const card = findHudCard(id);
    logger.info('hud: discard card', { id, filePath: card?.filePath });
    const removed = removeHudCard(id);
    if (removed) {
      try {
        await unlink(removed.filePath);
        logger.info('hud: deleted', { filePath: removed.filePath });
      } catch (err) {
        logger.warn('hud: delete failed', err);
      }
    }
  });

  ipcMain.handle(IPC.hud.copyCard, (_evt, id: number) => {
    const card = findHudCard(id);
    logger.info('hud: copy card', { id, filePath: card?.filePath });
    if (!card) return;
    const img = nativeImage.createFromPath(card.filePath);
    if (!img.isEmpty()) clipboard.writeImage(img);
  });

  ipcMain.handle(IPC.hud.saveCard, async (_evt, id: number) => {
    const card = findHudCard(id);
    logger.info('hud: save card', { id, filePath: card?.filePath });
    if (!card) return { saved: false, path: null };
    const focused = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(focused ?? new BrowserWindow({ show: false }), {
      defaultPath: basename(card.filePath),
      filters: [{ name: 'PNG', extensions: ['png'] }],
    });
    if (result.canceled || !result.filePath) return { saved: false, path: null };
    await copyFile(card.filePath, result.filePath);
    logger.info('hud: saved as', { from: card.filePath, to: result.filePath });
    return { saved: true, path: result.filePath };
  });

  ipcMain.handle(IPC.hud.openCardInEditor, (_evt, id: number) => {
    const card = findHudCard(id);
    logger.info('hud: open card in editor', { id, filePath: card?.filePath });
    if (!card) return;
    showEditorWithImage(card.filePath);
    removeHudCard(id);
  });

  // Drag-and-drop OUT to other apps. Note: `ipcMain.on` (one-way `send`),
  // not `handle` — `webContents.startDrag` must be called synchronously
  // during a dragstart event, and an `invoke` round-trip would arrive too
  // late.
  ipcMain.on(IPC.hud.beginDrag, (event, id: number) => {
    const card = findHudCard(id);
    if (!card) return;
    const fullImg = nativeImage.createFromPath(card.filePath);
    if (fullImg.isEmpty()) {
      logger.warn('hud: beginDrag — empty image', { id, filePath: card.filePath });
      return;
    }
    // 64×64 thumbnail used as the drag cursor avatar.
    const icon = fullImg.resize({ height: 64 });
    logger.info('hud: drag started', { id, filePath: card.filePath });
    event.sender.startDrag({ file: card.filePath, icon });
  });

  // Re-export for explicit symbol use elsewhere
  void showHudWithImage;
}
