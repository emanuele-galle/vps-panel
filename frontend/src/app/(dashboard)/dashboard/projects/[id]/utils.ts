import { File, FileText, Image, Video } from 'lucide-react';
import { adminerUrl, fileBrowserBaseUrl } from '@/lib/env';

export const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return Image;
  if (['mp4', 'webm', 'avi', 'mov'].includes(ext || '')) return Video;
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '')) return FileText;
  return File;
};

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const getStatusVariant = (
  status: string
): 'default' | 'success' | 'warning' | 'error' | 'info' => {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'INACTIVE':
      return 'error';
    case 'BUILDING':
      return 'warning';
    case 'ERROR':
      return 'error';
    default:
      return 'default';
  }
};

export const getTemplateLabel = (template: string) => {
  const templates: Record<string, string> = {
    WORDPRESS: 'WordPress',
    NODEJS: 'Node.js',
    NEXTJS: 'Next.js',
    REACT: 'React',
    LARAVEL: 'Laravel',
    PYTHON: 'Python',
    STATIC: 'Static HTML',
  };
  return templates[template] || template;
};

export const getAdminerUrl = (db: any) => {
  const params = new URLSearchParams();

  switch (db.type) {
    case 'POSTGRESQL':
      params.set('pgsql', db.host);
      break;
    case 'MYSQL':
      params.set('server', db.host);
      break;
    case 'MONGODB':
      params.set('mongo', db.host);
      break;
    default:
      params.set('server', db.host);
  }

  params.set('username', db.username);
  params.set('db', db.databaseName);

  return `${adminerUrl}/?${params.toString()}`;
};

export const getFileBrowserUrl = (project: any) => {
  return `${fileBrowserBaseUrl}/files/${project?.path?.split('/').pop() || project?.slug}`;
};
