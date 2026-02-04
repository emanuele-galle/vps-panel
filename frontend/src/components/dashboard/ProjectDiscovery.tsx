'use client';

import { useState, useEffect } from 'react';
import {
  Search,
  FolderPlus,
  Package,
  FileCode,
  Database,
  Settings,
  Check,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Import,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { projectsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

interface DiscoveredProject {
  folderName: string;
  path: string;
  name: string;
  slug: string;
  template: string;
  hasPackageJson: boolean;
  hasDockerCompose: boolean;
  hasEcosystem: boolean;
  hasClaudeMd: boolean;
  detectedInfo: {
    description?: string;
    previewUrl?: string;
  };
}

interface DiscoveryResult {
  discovered: DiscoveredProject[];
  alreadyRegistered: string[];
  errors: { folder: string; error: string }[];
}

export function ProjectDiscovery() {
  const { user } = useAuthStore();
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [isImportingAll, setIsImportingAll] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editedNames, setEditedNames] = useState<Record<string, string>>({});

  // Only admins can use discovery
  if (user?.role !== 'ADMIN') {
    return null;
  }

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    try {
      const response = await projectsApi.discoverProjects();
      if (response.data.success) {
        setResult(response.data.data);
      } else {
        setError('Errore durante la scansione');
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante la scansione');
    } finally {
      setIsScanning(false);
    }
  };

  const handleImport = async (project: DiscoveredProject) => {
    setIsImporting(project.folderName);
    try {
      const response = await projectsApi.importProject({
        folderName: project.folderName,
        path: project.path,
        name: editedNames[project.folderName] || project.name,
        slug: project.slug,
        template: project.template,
        description: project.detectedInfo.description,
        previewUrl: project.detectedInfo.previewUrl,
      });

      if (response.data.success) {
        // Remove from discovered list
        setResult((prev) =>
          prev
            ? {
                ...prev,
                discovered: prev.discovered.filter(
                  (p) => p.folderName !== project.folderName
                ),
                alreadyRegistered: [...prev.alreadyRegistered, project.folderName],
              }
            : null
        );
      }
    } catch (err: any) {
      setError(`Errore importazione ${project.name}: ${err.message}`);
    } finally {
      setIsImporting(null);
    }
  };

  const handleImportAll = async () => {
    setIsImportingAll(true);
    try {
      const response = await projectsApi.importAllProjects();
      if (response.data.success) {
        // Refresh the scan
        await handleScan();
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'importazione');
    } finally {
      setIsImportingAll(false);
    }
  };

  const getTemplateIcon = (template: string) => {
    switch (template) {
      case 'NEXTJS':
      case 'REACT':
        return <FileCode className="h-4 w-4" />;
      case 'NODEJS':
        return <Package className="h-4 w-4" />;
      case 'WORDPRESS':
      case 'LARAVEL':
        return <Database className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getTemplateColor = (template: string) => {
    switch (template) {
      case 'NEXTJS':
        return 'bg-black text-white';
      case 'REACT':
        return 'bg-primary text-white';
      case 'NODEJS':
        return 'bg-success text-white';
      case 'WORDPRESS':
        return 'bg-primary text-primary-foreground';
      case 'PYTHON':
        return 'bg-warning/100 text-black';
      default:
        return 'bg-muted/500 text-white';
    }
  };

  return (
    <Card className="mb-6 border-dashed border-2 border-primary/40 bg-primary/10 bg-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg text-primary">
              Project Discovery
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {result && result.discovered.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleImportAll}
                disabled={isImportingAll}
              >
                {isImportingAll ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Import className="h-4 w-4 mr-1" />
                )}
                Importa Tutti ({result.discovered.length})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleScan}
              disabled={isScanning}
            >
              {isScanning ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Scansiona
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Trova progetti non registrati in /var/www/projects
        </p>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-destructive/15 text-destructive rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {!result && !isScanning && (
          <div className="text-center py-6 text-muted-foreground">
            <FolderPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Clicca "Scansiona" per cercare progetti non registrati</p>
          </div>
        )}

        {isScanning && (
          <div className="text-center py-6">
            <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
            <p className="text-muted-foreground">Scansione in corso...</p>
          </div>
        )}

        {result && !isScanning && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex gap-4 text-sm">
              <span className="text-success">
                <Check className="h-4 w-4 inline mr-1" />
                {result.alreadyRegistered.length} registrati
              </span>
              <span className="text-primary">
                <FolderPlus className="h-4 w-4 inline mr-1" />
                {result.discovered.length} da importare
              </span>
              {result.errors.length > 0 && (
                <span className="text-destructive">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  {result.errors.length} errori
                </span>
              )}
            </div>

            {/* Discovered Projects */}
            {result.discovered.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">
                  Progetti da importare:
                </h4>
                {result.discovered.map((project) => (
                  <div
                    key={project.folderName}
                    className="flex items-center justify-between p-3 bg-card rounded-lg border border-border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {editingProject === project.folderName ? (
                          <Input
                            value={editedNames[project.folderName] || project.name}
                            onChange={(e) =>
                              setEditedNames((prev) => ({
                                ...prev,
                                [project.folderName]: e.target.value,
                              }))
                            }
                            onBlur={() => setEditingProject(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') setEditingProject(null);
                            }}
                            className="h-7 text-sm font-medium w-64"
                            autoFocus
                          />
                        ) : (
                          <span
                            className="font-medium text-foreground cursor-pointer hover:text-primary"
                            onClick={() => setEditingProject(project.folderName)}
                            title="Clicca per modificare il nome"
                          >
                            {editedNames[project.folderName] || project.name}
                          </span>
                        )}
                        <Badge className={getTemplateColor(project.template)}>
                          {getTemplateIcon(project.template)}
                          <span className="ml-1">{project.template}</span>
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono">{project.folderName}</span>
                        <span>|</span>
                        <span>slug: {project.slug}</span>
                        {project.hasPackageJson && (
                          <Badge variant="default" className="text-xs py-0">
                            package.json
                          </Badge>
                        )}
                        {project.hasDockerCompose && (
                          <Badge variant="default" className="text-xs py-0">
                            docker-compose
                          </Badge>
                        )}
                        {project.hasEcosystem && (
                          <Badge variant="default" className="text-xs py-0">
                            PM2
                          </Badge>
                        )}
                      </div>
                      {project.detectedInfo.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {project.detectedInfo.description}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleImport(project)}
                      disabled={isImporting === project.folderName}
                    >
                      {isImporting === project.folderName ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Import className="h-4 w-4 mr-1" />
                          Importa
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* No new projects */}
            {result.discovered.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                <Check className="h-8 w-8 mx-auto mb-2 text-success" />
                <p>Tutti i progetti sono registrati!</p>
              </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-destructive">
                  Errori:
                </h4>
                {result.errors.map((err, idx) => (
                  <div
                    key={idx}
                    className="text-xs p-2 bg-destructive/10 text-destructive rounded"
                  >
                    <span className="font-mono">{err.folder}</span>: {err.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
