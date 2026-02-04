'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Play,
  Square,
  RotateCw,
  Trash2,
  ExternalLink,
  MoreHorizontal,
  Eye,
  HardDrive,
  Loader2,
  Copy,
  Terminal,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from '@/components/ui/context-menu';
import { useProjectsStore } from '@/store/projectsStore';
import { Project } from '@/types';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { logComponentError } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// ============================================
// TYPES & CONSTANTS
// ============================================

interface ProjectCardProps {
  project: Project;
}

interface ProjectSize {
  folder: { size: number; sizeFormatted: string };
  containers: { size: number; sizeFormatted: string; count: number };
  databases: { size: number; sizeFormatted: string; count: number };
  total: { size: number; sizeFormatted: string };
}

const TEMPLATE_LABELS: Record<string, string> = {
  WORDPRESS: 'WordPress',
  NODEJS: 'Node.js',
  NEXTJS: 'Next.js',
  REACT: 'React',
  LARAVEL: 'Laravel',
  PYTHON: 'Python',
  STATIC: 'HTML Statico',
};

const TEMPLATE_COLORS: Record<string, string> = {
  WORDPRESS: 'bg-[#21759b]/10 text-[#21759b] dark:bg-[#21759b]/20 dark:text-[#21759b] border-[#21759b]/20',
  NODEJS: 'bg-success/10 text-success border-success/20',
  NEXTJS: 'bg-foreground/10 text-foreground border-foreground/20',
  REACT: 'bg-[#61dafb]/10 text-[#61dafb] dark:bg-[#61dafb]/20 border-[#61dafb]/20',
  LARAVEL: 'bg-destructive/10 text-destructive border-destructive/20',
  PYTHON: 'bg-warning/10 text-warning border-warning/20',
  STATIC: 'bg-muted text-muted-foreground border-muted-foreground/20',
};

type StatusVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

// ============================================
// HELPERS
// ============================================

function getStatusVariant(status: string): StatusVariant {
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
}

function getStatusClasses(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'badge-success';
    case 'INACTIVE':
      return 'bg-muted text-muted-foreground';
    case 'BUILDING':
      return 'badge-warning';
    case 'ERROR':
      return 'badge-error';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getTemplateLabel(template: string): string {
  return TEMPLATE_LABELS[template] || template;
}

function getTemplateColor(template: string): string {
  return TEMPLATE_COLORS[template] || 'bg-primary/10 text-primary border-primary/20';
}

function normalizeUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return 'https://' + url;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();
  const { startProject, stopProject, restartProject, deleteProject } = useProjectsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [projectSize, setProjectSize] = useState<ProjectSize | null>(null);
  const [loadingSize, setLoadingSize] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    fetchProjectSize();
  }, [project.id]);

  const fetchProjectSize = async () => {
    try {
      setLoadingSize(true);
      const response = await api.get('/projects/' + project.id + '/size');
      if (response.data.success) {
        setProjectSize(response.data.data);
      }
    } catch (error: unknown) {
      logComponentError(error, 'ProjectCard', 'fetchSize');
    } finally {
      setLoadingSize(false);
    }
  };

  const handleStart = async () => {
    setIsLoading(true);
    try {
      await startProject(project.id);
    } catch (error: unknown) {
      logComponentError(error, 'ProjectCard', 'start');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    try {
      await stopProject(project.id);
    } catch (error: unknown) {
      logComponentError(error, 'ProjectCard', 'stop');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestart = async () => {
    setIsLoading(true);
    try {
      await restartProject(project.id);
    } catch (error: unknown) {
      logComponentError(error, 'ProjectCard', 'restart');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        'Sei sicuro di voler eliminare "' + project.name + '"? Questa azione non può essere annullata.'
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteProject(project.id);
    } catch (error: unknown) {
      logComponentError(error, 'ProjectCard', 'delete');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewDetails = () => {
    router.push('/dashboard/projects/' + project.id);
  };

  const handleOpenPreview = () => {
    if (project.previewUrl) {
      window.open(normalizeUrl(project.previewUrl), '_blank');
    }
  };

  const handleCopySlug = async () => {
    await navigator.clipboard.writeText(project.slug);
  };

  const handleCopyUrl = async () => {
    if (project.previewUrl) {
      await navigator.clipboard.writeText(normalizeUrl(project.previewUrl));
    }
  };

  const handleOpenLogs = () => {
    router.push('/dashboard/projects/' + project.id + '?tab=logs');
  };

  const isActive = project.status === 'ACTIVE';
  const statusLabel = isActive ? 'Attivo' : 'Fermo';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
        >
          <Card className={cn(
            'glass border-border/50 transition-all duration-200 group',
            isHovered && 'shadow-lg border-primary/30',
            isActive && isHovered && 'glow-primary'
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Project Name */}
                  <h3 className="text-base sm:text-lg font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                  {/* Slug */}
                  <p className="text-sm text-muted-foreground mt-1 truncate font-mono text-xs">
                    {project.slug}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  {isActive && (
                    <span className="status-dot status-dot-healthy status-dot-pulse" />
                  )}
                  <Badge className={cn('flex-shrink-0', getStatusClasses(project.status))}>
                    {project.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pb-3">
              <div className="space-y-3">
                {/* Description */}
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description}
                  </p>
                )}

                {/* Tags Row */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={cn('text-xs', getTemplateColor(project.template))}
                  >
                    {getTemplateLabel(project.template)}
                  </Badge>
                  {project.containers && project.containers.length > 0 && (
                    <Badge variant="outline" className="text-xs bg-accent/10 text-accent-foreground border-accent/20">
                      {project.containers.length} Container
                    </Badge>
                  )}
                </div>

                {/* Project Size */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <HardDrive className="h-4 w-4 flex-shrink-0" />
                  {loadingSize ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span className="text-xs">Calcolo...</span>
                    </span>
                  ) : projectSize ? (
                    <span
                      className="text-xs"
                      title={`Cartella: ${projectSize.folder.sizeFormatted}, Container: ${projectSize.containers.sizeFormatted}, Database: ${projectSize.databases.sizeFormatted}`}
                    >
                      {projectSize.total.sizeFormatted}
                    </span>
                  ) : (
                    <span className="text-xs">N/A</span>
                  )}
                </div>

                {/* Preview URL */}
                {project.previewUrl && (
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <a
                      href={normalizeUrl(project.previewUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 hover:underline truncate transition-colors text-xs"
                    >
                      {project.previewUrl.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}

                {/* Created Date */}
                <div className="text-xs text-muted-foreground/70">
                  Creato:{' '}
                  {new Date(project.createdAt).toLocaleDateString('it-IT', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-3 border-t border-border/50">
              {/* Mobile & Tablet: Dropdown Menu */}
              <div className="flex xl:hidden items-center justify-between w-full gap-2">
                <Badge className={cn('text-xs', getStatusClasses(project.status))}>
                  {statusLabel}
                </Badge>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" size="sm" className="h-9 px-3 gap-2">
                      <span className="text-sm">Azioni</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={handleViewDetails} className="py-2.5">
                      <Eye className="h-4 w-4 mr-3 text-primary" />
                      <span className="font-medium">Vedi Dettagli</span>
                    </DropdownMenuItem>
                    {project.previewUrl && isActive && (
                      <DropdownMenuItem onClick={handleOpenPreview} className="py-2.5">
                        <ExternalLink className="h-4 w-4 mr-3 text-info" />
                        <span className="font-medium">Apri Sito Web</span>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    {isActive ? (
                      <>
                        <DropdownMenuItem onClick={handleStop} disabled={isLoading} className="py-2.5">
                          <Square className="h-4 w-4 mr-3 text-warning" />
                          <span className="font-medium">Ferma Progetto</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleRestart} disabled={isLoading} className="py-2.5">
                          <RotateCw className="h-4 w-4 mr-3 text-info" />
                          <span className="font-medium">Riavvia Progetto</span>
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem onClick={handleStart} disabled={isLoading} className="py-2.5">
                        <Play className="h-4 w-4 mr-3 text-success" />
                        <span className="font-medium">Avvia Progetto</span>
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={handleDelete}
                      disabled={isLoading}
                      className="py-2.5 text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-3" />
                      <span className="font-medium">Elimina Progetto</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Desktop: Full Button Row */}
              <div className="hidden xl:flex items-center justify-between w-full gap-2">
                <div className="flex items-center gap-1 flex-wrap">
                  {isActive ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStop}
                        disabled={isLoading}
                        className="h-8 hover:bg-warning/10 hover:border-warning hover:text-warning"
                      >
                        <Square className="h-3.5 w-3.5 mr-1" />
                        Ferma
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRestart}
                        disabled={isLoading}
                        className="h-8 hover:bg-info/10 hover:border-info hover:text-info"
                      >
                        <RotateCw className="h-3.5 w-3.5 mr-1" />
                        Riavvia
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStart}
                      disabled={isLoading}
                      className="h-8 hover:bg-success/10 hover:border-success hover:text-success"
                    >
                      <Play className="h-3.5 w-3.5 mr-1" />
                      Avvia
                    </Button>
                  )}

                  {project.previewUrl && isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenPreview}
                      className="h-8 hover:bg-primary/10 hover:border-primary hover:text-primary"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewDetails}
                    className="h-8 hover:bg-primary/10 hover:border-primary hover:text-primary"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Dettagli
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isLoading}
                    className="h-8 text-destructive hover:bg-destructive/10 hover:border-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      </ContextMenuTrigger>

      {/* Right-click Context Menu */}
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleViewDetails}>
          <Eye className="h-4 w-4 mr-2 text-primary" />
          Vedi Dettagli
        </ContextMenuItem>

        {project.previewUrl && isActive && (
          <ContextMenuItem onClick={handleOpenPreview}>
            <ExternalLink className="h-4 w-4 mr-2 text-info" />
            Apri Sito Web
            <ContextMenuShortcut>Tab</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        <ContextMenuItem onClick={handleOpenLogs}>
          <Terminal className="h-4 w-4 mr-2 text-accent-foreground" />
          Vedi Logs
        </ContextMenuItem>

        <ContextMenuSeparator />

        {isActive ? (
          <>
            <ContextMenuItem onClick={handleStop} disabled={isLoading}>
              <Square className="h-4 w-4 mr-2 text-warning" />
              Ferma Progetto
            </ContextMenuItem>
            <ContextMenuItem onClick={handleRestart} disabled={isLoading}>
              <RotateCw className="h-4 w-4 mr-2 text-info" />
              Riavvia Progetto
            </ContextMenuItem>
          </>
        ) : (
          <ContextMenuItem onClick={handleStart} disabled={isLoading}>
            <Play className="h-4 w-4 mr-2 text-success" />
            Avvia Progetto
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleCopySlug}>
          <Copy className="h-4 w-4 mr-2 text-muted-foreground" />
          Copia Slug
        </ContextMenuItem>

        {project.previewUrl && (
          <ContextMenuItem onClick={handleCopyUrl}>
            <Copy className="h-4 w-4 mr-2 text-muted-foreground" />
            Copia URL
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={handleDelete}
          disabled={isLoading}
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Elimina Progetto
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ============================================
// SKELETON COMPONENT
// ============================================

export function ProjectCardSkeleton() {
  return (
    <Card className="glass border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            <div className="h-3 w-24 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-3">
          <div className="h-4 w-full bg-muted rounded animate-pulse" />
          <div className="flex gap-2">
            <div className="h-5 w-16 bg-muted rounded animate-pulse" />
            <div className="h-5 w-20 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-3 w-24 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t border-border/50">
        <div className="flex items-center justify-between w-full gap-2">
          <div className="h-8 w-20 bg-muted rounded animate-pulse" />
          <div className="h-8 w-24 bg-muted rounded animate-pulse" />
        </div>
      </CardFooter>
    </Card>
  );
}

export default ProjectCard;
