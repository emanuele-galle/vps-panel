export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  permissions: string;
}

export interface TreeNode extends FileItem {
  children?: TreeNode[];
  isExpanded?: boolean;
  isLoading?: boolean;
}

export type ViewMode = 'table' | 'tree';
export type SortField = 'name' | 'type' | 'size' | 'modified';
export type SortOrder = 'asc' | 'desc';
