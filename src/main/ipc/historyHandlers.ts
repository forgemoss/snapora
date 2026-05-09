import { ipcMain, shell } from 'electron';
import { unlink } from 'node:fs/promises';
import logger from '@main/logger';
import { clearCaptures, deleteCapture, listCaptures, type CaptureRow } from '@main/storage/db';
import { toSnapUrl } from '@main/security/protocol';
import { showEditorWithImage } from '@main/windows/editor';
import { IPC } from '@shared/ipc';

export interface HistoryItem extends Omit<CaptureRow, 'filePath'> {
  filePath: string;
  snapUrl: string;
}

export function registerHistoryHandlers(): void {
  ipcMain.handle(IPC.history.list, (_evt, limit = 100) => {
    const rows = listCaptures(limit);
    return rows.map<HistoryItem>((row) => ({
      ...row,
      snapUrl: toSnapUrl(row.filePath),
    }));
  });

  ipcMain.handle(IPC.history.openInEditor, (_evt, id: number) => {
    const item = listCaptures(500).find((r) => r.id === id);
    if (!item || !item.exists) return;
    showEditorWithImage(item.filePath);
  });

  ipcMain.handle(IPC.history.revealInFinder, (_evt, id: number) => {
    const item = listCaptures(500).find((r) => r.id === id);
    if (!item) return;
    shell.showItemInFolder(item.filePath);
  });

  ipcMain.handle(IPC.history.deleteEntry, async (_evt, id: number, alsoFile: boolean) => {
    const item = listCaptures(500).find((r) => r.id === id);
    deleteCapture(id);
    if (alsoFile && item?.exists) {
      try {
        await unlink(item.filePath);
      } catch (err) {
        logger.warn('history: unlink failed', err);
      }
    }
  });

  ipcMain.handle(IPC.history.clearAll, () => {
    clearCaptures();
    logger.info('history: cleared all rows');
  });
}
