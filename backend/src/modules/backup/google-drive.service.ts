import { google, drive_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { prisma } from '../../services/prisma.service';
import { BackupStatus } from '@prisma/client';
import log from '../../services/logger.service';

/**
 * Google Drive Service per l'upload dei backup
 */
export class GoogleDriveService {
  private drive: drive_v3.Drive | null = null;
  private auth: JWT | null = null;

  constructor() {
    this.initializeAuth();
  }

  /**
   * Inizializza l'autenticazione con Google Drive API
   */
  private initializeAuth() {
    const credentials = process.env.GOOGLE_DRIVE_CREDENTIALS;

    if (!credentials) {
      log.warn('[Google Drive] Credenziali non configurate. Upload su Drive disabilitato.');
      return;
    }

    try {
      const credentialsJson = JSON.parse(credentials);

      this.auth = new JWT({
        email: credentialsJson.client_email,
        key: credentialsJson.private_key,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      log.info('[Google Drive] Autenticazione configurata con successo');
    } catch (error) {
      log.error('[Google Drive] Errore durante inizializzazione:', error);
    }
  }

  /**
   * Verifica se Google Drive è configurato
   */
  isConfigured(): boolean {
    return this.auth !== null && this.drive !== null;
  }

  /**
   * Carica un backup su Google Drive
   */
  async uploadBackup(backupId: string, folderId?: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive non configurato. Aggiungi GOOGLE_DRIVE_CREDENTIALS al file .env');
    }

    // Ottieni il backup dal database
    const backup = await prisma.backupUpload.findUnique({
      where: { id: backupId },
    });

    if (!backup) {
      throw new Error('Backup non trovato');
    }

    try {
      // Ottieni dimensione file
      const fileStats = await stat(backup.filepath);

      // Prepara metadata del file
      const fileMetadata: drive_v3.Schema$File = {
        name: backup.originalName,
        mimeType: backup.mimeType,
      };

      // Se specificato, metti il file in una cartella specifica
      if (folderId) {
        fileMetadata.parents = [folderId];
      }

      // Carica il file
      const media = {
        mimeType: backup.mimeType,
        body: createReadStream(backup.filepath),
      };

      log.info(`[Google Drive] Caricamento backup ${backup.originalName} (${fileStats.size} bytes)...`);

      const response = await this.drive!.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, size, webViewLink, webContentLink',
      });

      const fileId = response.data.id!;
      log.info(`[Google Drive] Upload completato. File ID: ${fileId}`);

      // Aggiorna il backup nel database
      await prisma.backupUpload.update({
        where: { id: backupId },
        data: {
          driveFileId: fileId,
          driveExportedAt: new Date(),
          status: BackupStatus.EXPORTED,
        },
      });

      return fileId!;
    } catch (error) {
      log.error('[Google Drive] Errore durante upload:', error);

      // Aggiorna lo status a FAILED
      await prisma.backupUpload.update({
        where: { id: backupId },
        data: {
          status: BackupStatus.FAILED,
          errorMessage: `Errore upload Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });

      throw new Error(`Errore durante upload su Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Crea una cartella su Google Drive
   */
  async createFolder(folderName: string, parentFolderId?: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive non configurato');
    }

    const fileMetadata: drive_v3.Schema$File = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }

    try {
      const response = await this.drive!.files.create({
        requestBody: fileMetadata,
        fields: 'id, name',
      });

      log.info(`[Google Drive] Cartella creata: ${response.data.name} (${response.data.id})`);
      return response.data.id || '';
    } catch (error) {
      log.error('[Google Drive] Errore creazione cartella:', error);
      throw new Error(`Errore durante creazione cartella: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Elimina un file da Google Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive non configurato');
    }

    try {
      await this.drive!.files.delete({ fileId });
      log.info(`[Google Drive] File eliminato: ${fileId}`);
    } catch (error) {
      log.error('[Google Drive] Errore eliminazione file:', error);
      throw new Error(`Errore durante eliminazione file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ottieni informazioni su un file
   */
  async getFileInfo(fileId: string): Promise<drive_v3.Schema$File | null> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive non configurato');
    }

    try {
      const response = await this.drive!.files.get({
        fileId,
        fields: 'id, name, size, mimeType, createdTime, modifiedTime, webViewLink, webContentLink',
      });

      return response.data;
    } catch (error) {
      log.error('[Google Drive] Errore recupero info file:', error);
      throw new Error(`Errore durante recupero info file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Lista file in una cartella
   */
  async listFiles(folderId?: string, pageSize: number = 10): Promise<drive_v3.Schema$File[]> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive non configurato');
    }

    try {
      const query = folderId ? `'${folderId}' in parents` : undefined;

      const response = await this.drive!.files.list({
        q: query,
        pageSize,
        fields: 'files(id, name, size, mimeType, createdTime, modifiedTime)',
        orderBy: 'modifiedTime desc',
      });

      return response.data.files || [];
    } catch (error) {
      log.error('[Google Drive] Errore lista file:', error);
      throw new Error(`Errore durante lista file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const googleDriveService = new GoogleDriveService();
