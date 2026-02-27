'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import type { FileItem, TreeNode, ViewMode, SortField, SortOrder } from './types';
import { isTextFile } from './file-utils';

export interface Clipboard {
  items?: FileItem[];
  item: FileItem;
  operation: 'copy' | 'cut';
}

export interface UseFileManagerReturn {
  // State
  rootItems: TreeNode[];
  currentPath: string;
  currentItems: FileItem[];
  loading: boolean;
  error: string | null;
  viewMode: ViewMode;
  searchQuery: string;
  sortField: SortField;
  sortOrder: SortOrder;
  selectedItems: Set<string>;
  isDragging: boolean;
  previewFile: FileItem | null;
  previewContent: string;
  previewType: 'image' | 'pdf' | 'text' | null;
  clipboard: Clipboard | null;
  focusedIndex: number;
  showKeyboardHelp: boolean;
  favorites: string[];
  showUploadModal: boolean;
  showNewFolderModal: boolean;
  uploadFiles: File[];
  newFolderName: string;
  editingFile: FileItem | null;
  fileContent: string;
  isLoadingContent: boolean;
  extractingArchive: FileItem | null;
  extractDestination: string;
  uploadProgress: number;
  isUploading: boolean;

  // State setters (for UI binding)
  setViewMode: (mode: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setShowKeyboardHelp: (show: boolean) => void;
  setShowUploadModal: (show: boolean) => void;
  setShowNewFolderModal: (show: boolean) => void;
  setUploadFiles: (files: File[]) => void;
  setNewFolderName: (name: string) => void;
  setFileContent: (content: string) => void;
  setError: (error: string | null) => void;
  setIsDragging: (dragging: boolean) => void;
  setFocusedIndex: (index: number) => void;
  setExtractDestination: (dest: string) => void;

  // Actions
  loadDirectory: (path: string) => Promise<void>;
  loadRoot: () => Promise<void>;
  reloadView: () => void;
  toggleFavorite: (path: string) => void;
  toggleExpand: (targetPath: string) => Promise<void>;
  getBreadcrumbs: () => { name: string; path: string }[];
  handleDownload: (item: FileItem) => Promise<void>;
  handleDelete: (item: FileItem) => Promise<void>;
  handleBatchDelete: () => Promise<void>;
  handleBatchDownload: () => Promise<void>;
  handleBatchCopy: () => void;
  handleBatchCut: () => void;
  handleEdit: (item: FileItem) => Promise<void>;
  handleSaveFile: () => Promise<void>;
  handleNewFolder: () => Promise<void>;
  handleUpload: () => Promise<void>;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => Promise<void>;
  handleCopy: (item: FileItem) => void;
  handleCut: (item: FileItem) => void;
  handlePaste: () => Promise<void>;
  handlePreview: (item: FileItem) => Promise<void>;
  handleExtract: () => Promise<void>;
  handleCopyPath: (item: FileItem) => void;
  handleSort: (field: SortField) => void;
  toggleSelectItem: (path: string) => void;
  toggleSelectAll: () => void;
  handleExtractAction: (item: FileItem) => void;
  closePreview: () => void;
  closeUploadModal: () => void;
  closeNewFolderModal: () => void;
  closeEditFile: () => void;
  closeExtractModal: () => void;
}

export function useFileManager(): UseFileManagerReturn {
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
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
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

  const getCsrfToken = (): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    return match ? match[1] : null;
  };

  // --- Data loading ---
  // Uses axios api instance (has 401 → token refresh interceptor)
  const fetchDirectory = async (path: string = ''): Promise<FileItem[]> => {
    const res = await api.get('/files/list', { params: { path } });
    return res.data.data.items;
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
          setShowKeyboardHelp(prev => !prev);
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
  const downloadBlob = async (endpoint: string, params: Record<string, string>, filename: string) => {
    const res = await api.get(endpoint, { params, responseType: 'blob', timeout: 120000 });
    const blob = res.data as Blob;
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const handleDownload = async (item: FileItem) => {
    try {
      if (item.type === 'directory') {
        await downloadBlob('/files/download-zip', { path: item.path }, `${item.name}.zip`);
      } else {
        await downloadBlob('/files/download', { path: item.path }, item.name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download fallito');
    }
  };

  const handleDelete = async (item: FileItem) => {
    if (!confirm(`Eliminare ${item.name}?`)) return;
    try {
      await api.delete('/files/item', { data: { path: item.path } });
      reloadView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile eliminare');
    }
  };

  const handleBatchDownload = async () => {
    const items = currentItems.filter(i => selectedItems.has(i.path));
    if (items.length === 0) return;
    for (const item of items) {
      await handleDownload(item);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Eliminare ${selectedItems.size} elementi selezionati?`)) return;
    for (const path of selectedItems) {
      try {
        await api.delete('/files/item', { data: { path } });
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
      const res = await api.get('/files/content', { params: { path: item.path } });
      setFileContent(res.data.data.content);
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
      await api.post(`/files/upload?path=${encodeURIComponent(parentPath)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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
      await api.post('/files/directory', { path: currentPath, name: newFolderName });
      setShowNewFolderModal(false);
      setNewFolderName('');
      reloadView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile creare la cartella');
    }
  };

  const uploadFileWithProgress = (file: File, currentUploadPath: string): Promise<boolean> => {
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

      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
      xhr.open('POST', `${apiUrl}/files/upload?path=${encodeURIComponent(currentUploadPath)}`);
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
        const ok = await uploadFileWithProgress(file, currentPath);
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
          await api.post(`/files/upload?path=${encodeURIComponent(currentPath)}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          successCount++;
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

  const handleBatchCopy = () => {
    if (selectedItems.size === 0) return;
    const items = currentItems.filter(i => selectedItems.has(i.path));
    setClipboard({ item: items[0], items, operation: 'copy' });
    setError(`✓ ${items.length} elementi copiati negli appunti`);
    setTimeout(() => setError(null), 4000);
  };

  const handleBatchCut = () => {
    if (selectedItems.size === 0) return;
    const items = currentItems.filter(i => selectedItems.has(i.path));
    setClipboard({ item: items[0], items, operation: 'cut' });
    setError(`✂️ ${items.length} elementi tagliati negli appunti`);
    setTimeout(() => setError(null), 4000);
  };

  const handlePaste = async () => {
    if (!clipboard) { setError('Nessun elemento negli appunti'); return; }
    const itemsToPaste = clipboard.items || [clipboard.item];
    try {
      const endpoint = clipboard.operation === 'copy' ? '/files/copy' : '/files/move';
      let failed = 0;
      for (const item of itemsToPaste) {
        try {
          await api.post(endpoint, { sourcePath: item.path, destinationDir: currentPath });
        } catch {
          failed++;
        }
      }
      const op = clipboard.operation === 'copy' ? 'copiati' : 'spostati';
      if (failed === 0) {
        setError(`✓ ${itemsToPaste.length} elementi ${op} con successo`);
      } else {
        setError(`${itemsToPaste.length - failed}/${itemsToPaste.length} elementi ${op} (${failed} falliti)`);
      }
      setTimeout(() => setError(null), 5000);
      if (clipboard.operation === 'cut') setClipboard(null);
      setSelectedItems(new Set());
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
        const res = await api.get('/files/download', {
          params: { path: item.path },
          responseType: 'blob',
          timeout: 60000,
        });
        const objectUrl = URL.createObjectURL(res.data as Blob);
        setPreviewFile(item);
        setPreviewType(ext === 'pdf' ? 'pdf' : 'image');
        setPreviewContent(objectUrl);
      } else if (textExts.includes(ext) || item.size < 1000000) {
        try {
          const res = await api.get('/files/content', { params: { path: item.path } });
          const text = res.data.data.content;
          setPreviewFile(item);
          setPreviewType('text');
          setPreviewContent(text);
        } catch {
          // fallback: download as text
          const res = await api.get('/files/download', {
            params: { path: item.path },
            responseType: 'text',
          });
          setPreviewFile(item);
          setPreviewType('text');
          setPreviewContent(res.data as string);
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
      const res = await api.post('/files/extract', {
        archivePath: extractingArchive.path,
        destinationPath: extractDestination || extractingArchive.path.split('/').slice(0, -1).join('/'),
      });
      setExtractingArchive(null);
      setExtractDestination('');
      reloadView();
      setError(`Successo: ${res.data.data.filesExtracted} elementi estratti`);
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

  // --- Modal close helpers ---
  const closePreview = () => {
    setPreviewFile(null);
    setPreviewContent('');
    setPreviewType(null);
  };

  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadFiles([]);
  };

  const closeNewFolderModal = () => {
    setShowNewFolderModal(false);
    setNewFolderName('');
  };

  const closeEditFile = () => {
    setEditingFile(null);
    setFileContent('');
  };

  const closeExtractModal = () => {
    setExtractingArchive(null);
    setExtractDestination('');
  };

  return {
    // State
    rootItems,
    currentPath,
    currentItems,
    loading,
    error,
    viewMode,
    searchQuery,
    sortField,
    sortOrder,
    selectedItems,
    isDragging,
    previewFile,
    previewContent,
    previewType,
    clipboard,
    focusedIndex,
    showKeyboardHelp,
    favorites,
    showUploadModal,
    showNewFolderModal,
    uploadFiles,
    newFolderName,
    editingFile,
    fileContent,
    isLoadingContent,
    extractingArchive,
    extractDestination,
    uploadProgress,
    isUploading,

    // State setters
    setViewMode,
    setSearchQuery,
    setShowKeyboardHelp,
    setShowUploadModal,
    setShowNewFolderModal,
    setUploadFiles,
    setNewFolderName,
    setFileContent,
    setError,
    setIsDragging,
    setFocusedIndex,
    setExtractDestination,

    // Actions
    loadDirectory,
    loadRoot,
    reloadView,
    toggleFavorite,
    toggleExpand,
    getBreadcrumbs,
    handleDownload,
    handleDelete,
    handleBatchDelete,
    handleBatchDownload,
    handleBatchCopy,
    handleBatchCut,
    handleEdit,
    handleSaveFile,
    handleNewFolder,
    handleUpload,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleCopy,
    handleCut,
    handlePaste,
    handlePreview,
    handleExtract,
    handleCopyPath,
    handleSort,
    toggleSelectItem,
    toggleSelectAll,
    handleExtractAction,
    closePreview,
    closeUploadModal,
    closeNewFolderModal,
    closeEditFile,
    closeExtractModal,
  };
}
