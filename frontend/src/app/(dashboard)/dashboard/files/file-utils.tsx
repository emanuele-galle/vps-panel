import {
  Folder,
  File,
  FileArchive,
  FileCode,
  FileJson,
  FileText,
  FileImage,
} from 'lucide-react';
import type { FileItem, SortField, SortOrder } from './types';

export const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatPermissions = (perm: string) => {
  if (perm.length === 9) return perm;
  return perm;
};

export const isArchiveFile = (filename: string) => {
  const lower = filename.toLowerCase();
  return ['.zip', '.tar', '.tar.gz', '.tgz', '.tar.bz2', '.tbz2'].some(ext => lower.endsWith(ext));
};

export const getFileIcon = (item: FileItem) => {
  if (item.type === 'directory') {
    return <Folder className="h-4 w-4 text-blue-500" />;
  }

  const name = item.name.toLowerCase();
  if (isArchiveFile(name)) return <FileArchive className="h-4 w-4 text-purple-500" />;
  if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.jsx') || name.endsWith('.tsx')) {
    return <FileCode className="h-4 w-4 text-yellow-500" />;
  }
  if (name.endsWith('.json')) return <FileJson className="h-4 w-4 text-green-500" />;
  if (name.endsWith('.md') || name.endsWith('.txt')) return <FileText className="h-4 w-4 text-gray-500" />;
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].some(ext => name.endsWith(ext))) {
    return <FileImage className="h-4 w-4 text-pink-500" />;
  }
  return <File className="h-4 w-4 text-muted-foreground" />;
};

export const TEXT_EXTENSIONS = [
  '.md', '.txt', '.rst', '.adoc', '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.d.ts', '.json', '.json5', '.jsonc',
  '.yaml', '.yml', '.toml', '.ini', '.conf', '.config', '.sh', '.bash', '.zsh', '.fish',
  '.py', '.php', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.xml', '.svg',
  '.csv', '.sql', '.dockerfile', '.gitignore', '.dockerignore', '.prettierrc', '.eslintrc',
  '.editorconfig', '.log', '.env.example', '.env.template',
];

export const TEXT_FILENAMES = ['Dockerfile', 'Makefile', 'Procfile', 'README', 'LICENSE', 'CHANGELOG'];

export const isTextFile = (filename: string) => {
  return TEXT_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext)) ||
         TEXT_FILENAMES.some(name => filename === name);
};

export const getFilteredAndSortedItems = (
  items: FileItem[],
  searchQuery: string,
  sortField: SortField,
  sortOrder: SortOrder
) => {
  let filtered = items;

  if (searchQuery) {
    filtered = filtered.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const sorted = [...filtered].sort((a, b) => {
    let compareValue = 0;

    switch (sortField) {
      case 'name':
        compareValue = a.name.localeCompare(b.name);
        break;
      case 'type':
        compareValue = a.type.localeCompare(b.type);
        break;
      case 'size':
        compareValue = a.size - b.size;
        break;
      case 'modified':
        compareValue = new Date(a.modified).getTime() - new Date(b.modified).getTime();
        break;
    }

    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  // Directories first
  return sorted.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return 0;
  });
};
