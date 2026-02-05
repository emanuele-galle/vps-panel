'use client';

import { useState, useEffect } from 'react';
import {
  Folder,
  RefreshCw,
  Upload,
  FolderPlus,
  Home,
  ChevronRight,
  Search,
  Table as TableIcon,
  List,
  Trash2,
  HelpCircle,
  ClipboardPaste,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/authStore';
import type { FileItem, TreeNode, ViewMode, SortField, SortOrder } from './types';
import { isTextFile } from './file-utils';
import { FileTableView } from './FileTableView';
import { FileTreeView } from './FileTreeView';
import {
  KeyboardHelpModal,
  PreviewModal,
  UploadModal,
  NewFolderModal,
  EditFileModal,
  ExtractModal,
} from './FileManagerModals';

export default function FileManagerPage() {
  const { user } = useAuthStore();
  const [rootItems, setRootItems] = useState<TreeNode[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [currentItems, setCurrentItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | 'text' | null>(null);
  const [clipboard, setClipboard] = useState<{ item: FileItem; operation: 'copy' | 'cut' } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [extractingArchive, setExtractingArchive] = useState<FileItem | null>(null);
  const [extractDestination, setExtractDestination] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  const API_URL = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? `https://api.${window.location.hostname}`
    : 'http://localhost:3001';

  const getCsrfToken = (): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? match[1] : null;
  };

  const fetchWithCsrf = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const csrfToken = getCsrfToken();
    const headers = { ...options.headers };

    if (options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
      if (csrfToken) {
        (headers as any)['x-csrf-token'] = csrfToken;
      }
    }

    return fetch(url, { ...options, headers });
  };

  // --- Data loading ---
  const fetchDirectory = async (path: string = ''): Promise<FileItem[]> => {
    const response = await fetch(`${API_URL}/api/files/list?path=${encodeURIComponent(path)}`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Impossibile caricare la cartella');
    const data = await response.json();
    return data.data.items;
  };

  const loadDirectory = async (path: string = '') => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchDirectory(path);
      setCurrentItems(items);
      setCurrentPath(path);
      setSelectedItems(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const loadRoot = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchDirectory('');
      setRootItems(items.map(item => ({ ...item, isExpanded: false, children: [] })));
      setCurrentItems(items);
      setCurrentPath('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const reloadView = () => {
    if (viewMode === 'table') {
      loadDirectory(currentPath);
    } else {
      loadRoot();
    }
  };

  useEffect(() => {
    loadRoot();
    const savedFavorites = localStorage.getItem('file-browser-favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  // --- Favorites ---
  const toggleFavorite = (path: string) => {
    const newFavorites = favorites.includes(path)
      ? favorites.filter(f => f !== path)
      : [...favorites, path];
    setFavorites(newFavorites);
    localStorage.setItem('file-browser-favorites', JSON.stringify(newFavorites));
    const action = favorites.includes(path) ? 'rimosso dai' : 'aggiunto ai';
    setError(`Percorso ${action} preferiti`);
  };

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const items = currentItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => Math.min(items.length - 1, prev + 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (items[focusedIndex]) {
            const item = items[focusedIndex];
            if (item.type === 'directory') loadDirectory(item.path);
            else handlePreview(item);
          }
          break;
        case 'Delete':
          e.preventDefault();
          if (items[focusedIndex]) handleDelete(items[focusedIndex]);
          break;
        case 'c':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (items[focusedIndex]) handleCopy(items[focusedIndex]); }
          break;
        case 'x':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (items[focusedIndex]) handleCut(items[focusedIndex]); }
          break;
        case 'v':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); handlePaste(); }
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardHelp(!showKeyboardHelp);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentItems, focusedIndex, searchQuery, clipboard, showKeyboardHelp]);

  // --- Tree view ---
  const toggleExpand = async (targetPath: string) => {
    const updateNode = async (items: TreeNode[]): Promise<TreeNode[]> => {
      const updated = [];
      for (const item of items) {
        if (item.path === targetPath) {
          if (item.type === 'file') { updated.push(item); continue; }
          if (item.isExpanded) {
            updated.push({ ...item, isExpanded: false });
          } else {
            try {
              const children = await fetchDirectory(item.path);
              updated.push({
                ...item,
                isExpanded: true,
                children: children.map(child => ({ ...child, isExpanded: false, children: [] })),
              });
            } catch {
              updated.push({ ...item, isExpanded: false });
              setError('Impossibile caricare la cartella');
            }
          }
        } else if (item.children && item.isExpanded) {
          updated.push({ ...item, children: await updateNode(item.children) });
        } else {
          updated.push(item);
        }
      }
      return updated;
    };

    const newTree = await updateNode(rootItems);
    setRootItems(newTree);
  };

  // --- Breadcrumbs ---
  const getBreadcrumbs = () => {
    if (!currentPath) return [{ name: 'Home', path: '' }];
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Home', path: '' }];
    let accumulated = '';
    for (const part of parts) {
      accumulated += (accumulated ? '/' : '') + part;
      breadcrumbs.push({ name: part, path: accumulated });
    }
    return breadcrumbs;
  };

  // --- File operations ---
  const handleDownload = (item: FileItem) => {
    window.open(`${API_URL}/api/files/download?path=${encodeURIComponent(item.path)}`, '_blank');
  };

  const handleDelete = async (item: FileItem) => {
    if (!confirm(`Eliminare ${item.name}?`)) return;
    try {
      const response = await fetchWithCsrf(`${API_URL}/api/files/item`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: item.path }),
      });
      if (!response.ok) throw new Error('Impossibile eliminare');
      reloadView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile eliminare');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Eliminare ${selectedItems.size} elementi selezionati?`)) return;
    for (const path of selectedItems) {
      try {
        await fetchWithCsrf(`${API_URL}/api/files/item`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path }),
        });
      } catch (err) {
        console.error('Impossibile eliminare', path, err);
      }
    }
    setSelectedItems(new Set());
    reloadView();
  };

  const handleEdit = async (item: FileItem) => {
    if (item.type === 'directory') return;
    if (!isTextFile(item.name)) {
      setError('Puoi modificare solo file di testo');
      return;
    }
    setEditingFile(item);
    setIsLoadingContent(true);
    try {
      const response = await fetch(`${API_URL}/api/files/content?path=${encodeURIComponent(item.path)}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Impossibile caricare il file');
      const text = await response.text();
      setFileContent(text);
    } catch {
      setError('Impossibile caricare il contenuto del file');
      setEditingFile(null);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleSaveFile = async () => {
    if (!editingFile) return;
    const blob = new Blob([fileContent], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', blob, editingFile.name);
    const parentPath = editingFile.path.split('/').slice(0, -1).join('/');
    try {
      const response = await fetchWithCsrf(`${API_URL}/api/files/upload?path=${encodeURIComponent(parentPath)}`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) throw new Error('Impossibile salvare');
      setEditingFile(null);
      setFileContent('');
      reloadView();
    } catch {
      setError('Impossibile salvare il file');
    }
  };

  const handleNewFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const response = await fetchWithCsrf(`${API_URL}/api/files/directory`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath ? `${currentPath}/${newFolderName}` : newFolderName }),
      });
      if (!response.ok) throw new Error('Impossibile creare la cartella');
      setShowNewFolderModal(false);
      setNewFolderName('');
      reloadView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile creare la cartella');
    }
  };

  const uploadFileWithProgress = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => resolve(xhr.status >= 200 && xhr.status < 300));
      xhr.addEventListener('error', () => resolve(false));

      xhr.open('POST', `${API_URL}/api/files/upload?path=${encodeURIComponent(currentPath)}`);
      xhr.withCredentials = true;
      const csrfToken = getCsrfToken();
      if (csrfToken) xhr.setRequestHeader('x-csrf-token', csrfToken);
      xhr.send(formData);
    });
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    setIsUploading(true);
    setUploadProgress(0);
    let successCount = 0;
    const failedFiles: string[] = [];

    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        setUploadProgress(0);
        const ok = await uploadFileWithProgress(file);
        if (!ok) failedFiles.push(file.name);
        else successCount++;
      }

      setShowUploadModal(false);
      setUploadFiles([]);

      if (failedFiles.length === 0) {
        setError(`Successo: ${successCount} file caricati`);
      } else {
        setError(`Caricati: ${successCount}, Falliti: ${failedFiles.length} (${failedFiles.join(', ')})`);
      }
      reloadView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // --- Drag & Drop ---
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.currentTarget === e.target) setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    setLoading(true);
    let successCount = 0;
    const failedFiles: string[] = [];

    try {
      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const response = await fetchWithCsrf(`${API_URL}/api/files/upload?path=${encodeURIComponent(currentPath)}`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
          if (!response.ok) failedFiles.push(file.name);
          else successCount++;
        } catch {
          failedFiles.push(file.name);
        }
      }

      if (failedFiles.length === 0) {
        setError(`Successo: ${successCount} file caricati via drag & drop`);
        setTimeout(() => setError(null), 5000);
      } else {
        setError(`Caricati: ${successCount}, Falliti: ${failedFiles.length} (${failedFiles.join(', ')})`);
      }
      reloadView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento');
    } finally {
      setLoading(false);
    }
  };

  // --- Copy/Cut/Paste ---
  const handleCopy = (item: FileItem) => {
    setClipboard({ item, operation: 'copy' });
    setError(`✓ ${item.name} copiato negli appunti (Incolla per duplicare)`);
    setTimeout(() => setError(null), 4000);
  };

  const handleCut = (item: FileItem) => {
    setClipboard({ item, operation: 'cut' });
    setError(`✂️ ${item.name} tagliato negli appunti (Incolla per spostare)`);
    setTimeout(() => setError(null), 4000);
  };

  const handlePaste = async () => {
    if (!clipboard) { setError('Nessun elemento negli appunti'); return; }
    try {
      const endpoint = clipboard.operation === 'copy' ? '/copy' : '/move';
      const response = await fetchWithCsrf(`${API_URL}/api/files${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourcePath: clipboard.item.path, destinationDir: currentPath }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Operazione fallita');
      }
      setError(`✓ ${clipboard.item.name} ${clipboard.operation === 'copy' ? 'copiato' : 'spostato'} con successo`);
      setTimeout(() => setError(null), 5000);
      if (clipboard.operation === 'cut') setClipboard(null);
      reloadView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione fallita');
    }
  };

  // --- Preview ---
  const handlePreview = async (item: FileItem) => {
    if (item.type === 'directory') return;
    const ext = item.name.split('.').pop()?.toLowerCase() || '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const textExts = ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'xml', 'yaml', 'yml', 'env', 'log', 'sh', 'py', 'rb', 'php', 'go', 'rs', 'java', 'c', 'cpp', 'h'];

    setIsLoadingContent(true);
    try {
      if (imageExts.includes(ext) || ext === 'pdf') {
        const response = await fetch(`${API_URL}/api/files/download?path=${encodeURIComponent(item.path)}`, { credentials: 'include' });
        if (!response.ok) throw new Error('Download fallito');
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setPreviewFile(item);
        setPreviewType(ext === 'pdf' ? 'pdf' : 'image');
        setPreviewContent(objectUrl);
      } else if (textExts.includes(ext) || item.size < 1000000) {
        try {
          const contentResponse = await fetch(`${API_URL}/api/files/content?path=${encodeURIComponent(item.path)}`, { credentials: 'include' });
          let text;
          if (contentResponse.ok) {
            const data = await contentResponse.json();
            text = data.data.content;
          } else {
            const downloadResponse = await fetch(`${API_URL}/api/files/download?path=${encodeURIComponent(item.path)}`, { credentials: 'include' });
            text = await downloadResponse.text();
          }
          setPreviewFile(item);
          setPreviewType('text');
          setPreviewContent(text);
        } catch {
          throw new Error('Impossibile caricare contenuto file');
        }
      } else {
        throw new Error('Tipo di file non supportato per preview. Usa Download.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile caricare preview');
    } finally {
      setIsLoadingContent(false);
    }
  };

  // --- Extract ---
  const handleExtract = async () => {
    if (!extractingArchive) return;
    try {
      const response = await fetchWithCsrf(`${API_URL}/api/files/extract`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archivePath: extractingArchive.path,
          destinationPath: extractDestination || extractingArchive.path.split('/').slice(0, -1).join('/'),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Estrazione fallita');
      setExtractingArchive(null);
      setExtractDestination('');
      reloadView();
      setError(`Successo: ${data.data.filesExtracted} elementi estratti`);
      setTimeout(() => setError(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Estrazione fallita');
    }
  };

  const handleCopyPath = (item: FileItem) => {
    navigator.clipboard.writeText(item.path);
    setError('Copiato!');
    setTimeout(() => setError(null), 2000);
  };

  // --- Selection ---
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const toggleSelectItem = (path: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(path)) newSelected.delete(path);
    else newSelected.add(path);
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === currentItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(currentItems.map(item => item.path)));
    }
  };

  const handleExtractAction = (item: FileItem) => {
    setExtractingArchive(item);
    setExtractDestination(item.path.split('/').slice(0, -1).join('/'));
  };

  // --- Render ---
  if (loading && currentItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">File Manager</h1>
          <div className="flex items-center gap-2">
            <Button onClick={() => setViewMode(viewMode === 'table' ? 'tree' : 'table')} variant="outline" size="sm">
              {viewMode === 'table' ? (
                <><List className="h-4 w-4 mr-2" />Vista Albero</>
              ) : (
                <><TableIcon className="h-4 w-4 mr-2" />Vista Tabella</>
              )}
            </Button>
            <Button onClick={loadRoot} variant="outline" size="sm" title="Ricarica">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setShowKeyboardHelp(!showKeyboardHelp)} variant="outline" size="sm" title="Aiuto scorciatoie tastiera">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Breadcrumbs */}
        <Card className="bg-muted/30">
          <CardContent className="py-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {getBreadcrumbs().map((crumb, index, arr) => (
                  <div key={crumb.path} className="flex items-center gap-2">
                    <button
                      onClick={() => loadDirectory(crumb.path)}
                      className="px-3 py-1.5 rounded-md hover:bg-primary/10 hover:text-primary transition-all duration-200 font-medium flex items-center gap-2"
                      title={crumb.path || '/var/www'}
                    >
                      {index === 0 ? (
                        <><Home className="h-4 w-4" /><span className="text-sm">Home</span></>
                      ) : (
                        <span className="text-sm">{crumb.name}</span>
                      )}
                    </button>
                    {index < arr.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono bg-background px-2 py-1 rounded border">
                  {currentPath ? `/var/www/${currentPath}` : '/var/www'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cerca file..." className="pl-8" />
            </div>
          </div>
          <Button onClick={() => setShowNewFolderModal(true)} size="sm">
            <FolderPlus className="h-4 w-4 mr-2" />Nuova Cartella
          </Button>
          <Button onClick={() => setShowUploadModal(true)} size="sm">
            <Upload className="h-4 w-4 mr-2" />Carica
          </Button>
          {clipboard && (
            <Button onClick={handlePaste} size="sm" variant="outline">
              <ClipboardPaste className="h-4 w-4 mr-2" />
              Incolla ({clipboard.operation === 'copy' ? 'Copia' : 'Sposta'})
            </Button>
          )}
          {selectedItems.size > 0 && (
            <Button onClick={handleBatchDelete} variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />Elimina ({selectedItems.size})
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Card className={error.includes('Successo') ? 'border-green-500' : 'border-destructive'}>
          <CardContent className="pt-6">
            <p className={`text-sm ${error.includes('Successo') ? 'text-green-600' : 'text-destructive'}`}>{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      <Card
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={isDragging ? 'border-2 border-primary border-dashed bg-primary/5' : ''}
      >
        <CardContent className="pt-6">
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/10 z-10 rounded-lg pointer-events-none">
              <div className="bg-background/95 p-6 rounded-lg shadow-lg border-2 border-primary">
                <Upload className="h-12 w-12 mx-auto mb-2 text-primary" />
                <p className="text-lg font-semibold text-primary">Rilascia i file qui</p>
              </div>
            </div>
          )}
          {viewMode === 'table' ? (
            <FileTableView
              currentItems={currentItems}
              searchQuery={searchQuery}
              sortField={sortField}
              sortOrder={sortOrder}
              selectedItems={selectedItems}
              favorites={favorites}
              onSort={handleSort}
              onToggleSelect={toggleSelectItem}
              onToggleSelectAll={toggleSelectAll}
              onLoadDirectory={loadDirectory}
              onEdit={handleEdit}
              onDownload={handleDownload}
              onPreview={handlePreview}
              onDelete={handleDelete}
              onCopy={handleCopy}
              onCut={handleCut}
              onCopyPath={handleCopyPath}
              onToggleFavorite={toggleFavorite}
              onExtract={handleExtractAction}
            />
          ) : (
            <FileTreeView
              nodes={rootItems}
              onToggleExpand={toggleExpand}
              onEdit={handleEdit}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onExtract={handleExtractAction}
            />
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {showKeyboardHelp && <KeyboardHelpModal onClose={() => setShowKeyboardHelp(false)} />}

      {previewFile && (
        <PreviewModal
          file={previewFile}
          content={previewContent}
          type={previewType}
          isLoading={isLoadingContent}
          onDownload={handleDownload}
          onEdit={handleEdit}
          onClose={() => { setPreviewFile(null); setPreviewContent(''); setPreviewType(null); }}
          onError={setError}
        />
      )}

      {showUploadModal && (
        <UploadModal
          uploadFiles={uploadFiles}
          onFilesChange={setUploadFiles}
          onUpload={handleUpload}
          onClose={() => { setShowUploadModal(false); setUploadFiles([]); }}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
        />
      )}

      {showNewFolderModal && (
        <NewFolderModal
          folderName={newFolderName}
          onFolderNameChange={setNewFolderName}
          onCreate={handleNewFolder}
          onClose={() => { setShowNewFolderModal(false); setNewFolderName(''); }}
        />
      )}

      {editingFile && (
        <EditFileModal
          file={editingFile}
          content={fileContent}
          isLoading={isLoadingContent}
          onContentChange={setFileContent}
          onSave={handleSaveFile}
          onClose={() => { setEditingFile(null); setFileContent(''); }}
        />
      )}

      {extractingArchive && (
        <ExtractModal
          file={extractingArchive}
          destination={extractDestination}
          onDestinationChange={setExtractDestination}
          onExtract={handleExtract}
          onClose={() => { setExtractingArchive(null); setExtractDestination(''); }}
        />
      )}
    </div>
  );
}
