'use client';

import {
  Folder,
  FolderOpen,
  Download,
  Trash2,
  ChevronRight,
  ChevronDown,
  Edit2,
  Archive,
} from 'lucide-react';
import type { TreeNode } from './types';
import { getFileIcon, formatSize, isArchiveFile } from './file-utils';

interface FileTreeViewProps {
  nodes: TreeNode[];
  onToggleExpand: (path: string) => void;
  onEdit: (item: TreeNode) => void;
  onDownload: (item: TreeNode) => void;
  onDelete: (item: TreeNode) => void;
  onExtract: (item: TreeNode) => void;
}

export function FileTreeView({
  nodes,
  onToggleExpand,
  onEdit,
  onDownload,
  onDelete,
  onExtract,
}: FileTreeViewProps) {
  return (
    <div className="border rounded-lg p-2 max-h-[70vh] overflow-y-auto bg-card">
      <TreeNodes
        nodes={nodes}
        level={0}
        onToggleExpand={onToggleExpand}
        onEdit={onEdit}
        onDownload={onDownload}
        onDelete={onDelete}
        onExtract={onExtract}
      />
      {nodes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Folder className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nessun elemento trovato</p>
        </div>
      )}
    </div>
  );
}

function TreeNodes({ nodes, level, onToggleExpand, onEdit, onDownload, onDelete, onExtract }: {
  nodes: TreeNode[];
  level: number;
  onToggleExpand: (path: string) => void;
  onEdit: (item: TreeNode) => void;
  onDownload: (item: TreeNode) => void;
  onDelete: (item: TreeNode) => void;
  onExtract: (item: TreeNode) => void;
}) {
  return (
    <>
      {nodes.map(node => (
        <div key={node.path} className="group">
          <div
            className="flex items-center gap-2 p-1.5 hover:bg-muted/70 rounded transition-colors"
            style={{ paddingLeft: `${level * 20 + 8}px` }}
          >
            {node.type === 'directory' ? (
              <button
                onClick={() => onToggleExpand(node.path)}
                className="flex items-center gap-1 flex-1 min-w-0"
              >
                {node.isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                {node.isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{node.name}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0 pl-5">
                {getFileIcon(node)}
                <span className="text-sm truncate">{node.name}</span>
                <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                  {formatSize(node.size)}
                </span>
              </div>
            )}

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              {node.type === 'file' && (
                <>
                  {isArchiveFile(node.name) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onExtract(node); }}
                      className="p-1 hover:bg-purple-500/20 rounded"
                      title="Estrai archivio"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(node); }}
                    className="p-1 hover:bg-blue-500/20 rounded"
                    title="Modifica file"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(node); }}
                className="p-1 hover:bg-primary/20 rounded"
                title={node.type === 'directory' ? 'Scarica come ZIP' : 'Scarica'}
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(node); }}
                className="p-1 hover:bg-destructive/20 rounded"
                title="Elimina"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {node.isExpanded && node.children && (
            <TreeNodes
              nodes={node.children}
              level={level + 1}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onDownload={onDownload}
              onDelete={onDelete}
              onExtract={onExtract}
            />
          )}
        </div>
      ))}
    </>
  );
}
