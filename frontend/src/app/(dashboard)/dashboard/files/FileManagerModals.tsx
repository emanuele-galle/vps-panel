'use client';

import {
  Download,
  RefreshCw,
  Upload,
  Archive,
  Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { FileItem } from './types';

// --- Keyboard Help Modal ---
interface KeyboardHelpModalProps {
  onClose: () => void;
}

export function KeyboardHelpModal({ onClose }: KeyboardHelpModalProps) {
  const shortcuts = [
    { key: '↑ / ↓', label: 'Naviga file' },
    { key: 'Enter', label: 'Apri/Anteprima' },
    { key: 'Delete', label: 'Elimina' },
    { key: 'Ctrl+C', label: 'Copia' },
    { key: 'Ctrl+X', label: 'Taglia' },
    { key: 'Ctrl+V', label: 'Incolla' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Scorciatoie Tastiera</h3>
            <Button onClick={onClose} variant="ghost" size="sm">✕</Button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {shortcuts.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <kbd className="px-2 py-1 bg-background border rounded text-xs font-mono">{key}</kbd>
                  <span className="text-sm">{label}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Altre funzionalità</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• <strong>Drag & Drop:</strong> Trascina file nella finestra per caricarli</li>
                <li>• <strong>Click destro:</strong> Menu contestuale con tutte le azioni</li>
                <li>• <strong>Doppio click:</strong> Apri cartella o anteprima file</li>
                <li>• <strong>Preferiti:</strong> Aggiungi cartelle frequenti ai preferiti</li>
              </ul>
            </div>

            <Button onClick={onClose} className="w-full">Ho capito</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Preview Modal ---
interface PreviewModalProps {
  file: FileItem;
  content: string;
  type: 'image' | 'pdf' | 'text' | null;
  isLoading: boolean;
  onDownload: (item: FileItem) => void;
  onEdit: (item: FileItem) => void;
  onClose: () => void;
  onError: (msg: string) => void;
}

export function PreviewModal({ file, content, type, isLoading, onDownload, onEdit, onClose, onError }: PreviewModalProps) {
  const handleClose = () => {
    if (content.startsWith('blob:')) {
      URL.revokeObjectURL(content);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[90vh] flex flex-col">
        <CardContent className="pt-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold truncate">{file.name}</h3>
            <Button onClick={handleClose} variant="ghost" size="sm">✕</Button>
          </div>

          <div className="flex-1 overflow-auto border rounded-lg bg-muted/20 relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {!isLoading && type === 'image' && (
              <div className="flex items-center justify-center h-full p-4">
                <img
                  src={content}
                  alt={file.name}
                  className="max-w-full max-h-full object-contain"
                  onError={() => onError('Errore caricamento immagine')}
                />
              </div>
            )}

            {!isLoading && type === 'pdf' && (
              <iframe src={content} className="w-full h-full" title={file.name} />
            )}

            {!isLoading && type === 'text' && (
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
                {content}
              </pre>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={() => onDownload(file)} variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            {type === 'text' && (
              <Button onClick={() => onEdit(file)} variant="outline" className="flex-1">
                <Edit2 className="h-4 w-4 mr-2" />
                Modifica
              </Button>
            )}
            <Button onClick={handleClose} variant="ghost" className="flex-1">
              Chiudi
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Upload Modal ---
interface UploadModalProps {
  uploadFiles: File[];
  onFilesChange: (files: File[]) => void;
  onUpload: () => void;
  onClose: () => void;
}

export function UploadModal({ uploadFiles, onFilesChange, onUpload, onClose }: UploadModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Carica File</h3>
          <div className="space-y-4">
            <Input
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  onFilesChange(Array.from(e.target.files));
                }
              }}
            />
            {uploadFiles.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Selezionati: {uploadFiles.map(f => f.name).join(', ')}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={onUpload} className="flex-1">Carica</Button>
              <Button onClick={onClose} variant="ghost">Annulla</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- New Folder Modal ---
interface NewFolderModalProps {
  folderName: string;
  onFolderNameChange: (name: string) => void;
  onCreate: () => void;
  onClose: () => void;
}

export function NewFolderModal({ folderName, onFolderNameChange, onCreate, onClose }: NewFolderModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Crea Nuova Cartella</h3>
          <div className="space-y-4">
            <Input
              value={folderName}
              onChange={(e) => onFolderNameChange(e.target.value)}
              placeholder="Nome cartella"
              onKeyDown={(e) => { if (e.key === 'Enter') onCreate(); }}
            />
            <div className="flex gap-2">
              <Button onClick={onCreate} className="flex-1">Crea</Button>
              <Button onClick={onClose} variant="ghost">Annulla</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Edit File Modal ---
interface EditFileModalProps {
  file: FileItem;
  content: string;
  isLoading: boolean;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function EditFileModal({ file, content, isLoading, onContentChange, onSave, onClose }: EditFileModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[85vh] flex flex-col">
        <CardContent className="pt-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Modifica File</h3>
              <p className="text-sm text-muted-foreground">{file.path}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={onSave} size="sm" disabled={isLoading}>Salva Modifiche</Button>
              <Button onClick={onClose} variant="ghost" size="sm">Annulla</Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              className="flex-1 w-full font-mono text-sm border rounded-lg p-4 resize-none bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary"
              spellCheck={false}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Extract Archive Modal ---
interface ExtractModalProps {
  file: FileItem;
  destination: string;
  onDestinationChange: (dest: string) => void;
  onExtract: () => void;
  onClose: () => void;
}

export function ExtractModal({ file, destination, onDestinationChange, onExtract, onClose }: ExtractModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Estrai Archivio</h3>
          <p className="text-sm text-muted-foreground mb-4">{file.name}</p>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Cartella di Destinazione</label>
              <Input
                value={destination}
                onChange={(e) => onDestinationChange(e.target.value)}
                placeholder="Lascia vuoto per la stessa cartella"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={onExtract} className="flex-1">
                <Archive className="h-4 w-4 mr-2" />
                Estrai
              </Button>
              <Button onClick={onClose} variant="ghost">Annulla</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
