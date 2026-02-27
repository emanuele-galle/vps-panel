'use client';

import {
  Folder,
  FolderOpen,
  Download,
  Trash2,
  MoreVertical,
  Copy,
  Archive,
  Edit2,
  Eye,
  Scissors,
  Clipboard,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FileItem, SortField, SortOrder } from './types';
import { getFileIcon, formatSize, formatDate, formatPermissions, isArchiveFile, getFilteredAndSortedItems } from './file-utils';

interface FileTableViewProps {
  currentItems: FileItem[];
  searchQuery: string;
  sortField: SortField;
  sortOrder: SortOrder;
  selectedItems: Set<string>;
  favorites: string[];
  onSort: (field: SortField) => void;
  onToggleSelect: (path: string) => void;
  onToggleSelectAll: () => void;
  onLoadDirectory: (path: string) => void;
  onEdit: (item: FileItem) => void;
  onDownload: (item: FileItem) => void;
  onPreview: (item: FileItem) => void;
  onDelete: (item: FileItem) => void;
  onCopy: (item: FileItem) => void;
  onCut: (item: FileItem) => void;
  onCopyPath: (item: FileItem) => void;
  onToggleFavorite: (path: string) => void;
  onExtract: (item: FileItem) => void;
}

export function FileTableView({
  currentItems,
  searchQuery,
  sortField,
  sortOrder,
  selectedItems,
  favorites,
  onSort,
  onToggleSelect,
  onToggleSelectAll,
  onLoadDirectory,
  onEdit,
  onDownload,
  onPreview,
  onDelete,
  onCopy,
  onCut,
  onCopyPath,
  onToggleFavorite,
  onExtract,
}: FileTableViewProps) {
  const items = getFilteredAndSortedItems(currentItems, searchQuery, sortField, sortOrder);

  const SortHeader = ({ field, label, className }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`p-2 text-left cursor-pointer hover:bg-muted/50 ${className || ''}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b bg-muted/30">
          <tr>
            <th className="p-2 w-10">
              <Checkbox
                checked={selectedItems.size === currentItems.length && currentItems.length > 0}
                onCheckedChange={onToggleSelectAll}
              />
            </th>
            <SortHeader field="name" label="Nome" />
            <SortHeader field="type" label="Tipo" className="w-24" />
            <SortHeader field="size" label="Dimensione" className="w-28" />
            <SortHeader field="modified" label="Modificato" className="w-40" />
            <th className="p-2 text-left w-32">Permessi</th>
            <th className="p-2 w-24">Azioni</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr
              key={item.path}
              className="border-b hover:bg-muted/30 transition-colors group"
            >
              <td className="p-2">
                <Checkbox
                  checked={selectedItems.has(item.path)}
                  onCheckedChange={() => onToggleSelect(item.path)}
                />
              </td>
              <td
                className="p-2 cursor-pointer"
                onClick={() => {
                  if (item.type === 'directory') {
                    onLoadDirectory(item.path);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  {getFileIcon(item)}
                  <span className="truncate">{item.name}</span>
                </div>
              </td>
              <td className="p-2 text-sm text-muted-foreground">
                {item.type === 'directory' ? 'Cartella' : 'File'}
              </td>
              <td className="p-2 text-sm text-muted-foreground">
                {item.type === 'file' ? formatSize(item.size) : '-'}
              </td>
              <td className="p-2 text-sm text-muted-foreground">
                {formatDate(item.modified)}
              </td>
              <td className="p-2 text-sm text-muted-foreground font-mono">
                {formatPermissions(item.permissions)}
              </td>
              <td className="p-2">
                <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onDownload(item)}
                  title={item.type === 'directory' ? 'Scarica come ZIP' : 'Scarica'}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {item.type === 'directory' && (
                      <>
                        <DropdownMenuItem onClick={() => onLoadDirectory(item.path)}>
                          <FolderOpen className="h-4 w-4 mr-2" />
                          Apri
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDownload(item)}>
                          <Download className="h-4 w-4 mr-2" />
                          Scarica come ZIP
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onToggleFavorite(item.path)}>
                          <Star className={`h-4 w-4 mr-2 ${favorites.includes(item.path) ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                          {favorites.includes(item.path) ? 'Rimuovi da Preferiti' : 'Aggiungi a Preferiti'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {item.type === 'file' && (
                      <>
                        <DropdownMenuItem onClick={() => onEdit(item)}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDownload(item)}>
                          <Download className="h-4 w-4 mr-2" />
                          Scarica
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onPreview(item)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Anteprima
                        </DropdownMenuItem>
                        {isArchiveFile(item.name) && (
                          <DropdownMenuItem onClick={() => onExtract(item)}>
                            <Archive className="h-4 w-4 mr-2" />
                            Estrai
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => onCopyPath(item)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copia Percorso
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onCopy(item)}>
                      <Clipboard className="h-4 w-4 mr-2" />
                      Copia
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onCut(item)}>
                      <Scissors className="h-4 w-4 mr-2" />
                      Taglia
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onDelete(item)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Elimina
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {searchQuery ? 'Nessun file corrisponde alla ricerca' : 'Nessun elemento trovato'}
          </p>
        </div>
      )}
    </div>
  );
}
