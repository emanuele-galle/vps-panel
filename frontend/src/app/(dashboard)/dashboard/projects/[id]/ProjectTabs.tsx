'use client';

import { useRouter } from 'next/navigation';
import {
  Terminal,
  Box,
  Database,
  Upload,
  Users,
  Settings,
  Layers,
  Activity,
  Server,
  File,
  Copy,
  Check,
  X,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { LogsViewer } from '@/components/dashboard/LogsViewer';
import { ProjectMembersTab } from '@/components/projects/ProjectMembersTab';
import { EnvironmentVariablesTab } from '@/components/projects/EnvironmentVariablesTab';
import { getStatusVariant, getFileIcon, formatFileSize, getAdminerUrl } from './utils';

export type TabType = 'logs' | 'containers' | 'databases' | 'uploads' | 'team' | 'env';

interface ProjectTabsProps {
  project: any;
  projectId: string;
  projectDatabases: any[];
  activeTab: TabType;
  tempFiles: any[];
  copiedText: string | null;
  uploadLoading: boolean;
  isAdmin: boolean;
  onTabChange: (tab: TabType) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteFile: (filename: string) => void;
  onClearAllFiles: () => void;
  onCopy: (text: string, label: string) => void;
}

export function ProjectTabs({
  project,
  projectId,
  projectDatabases,
  activeTab,
  tempFiles,
  copiedText,
  uploadLoading,
  isAdmin,
  onTabChange,
  onFileUpload,
  onDeleteFile,
  onClearAllFiles,
  onCopy,
}: ProjectTabsProps) {
  const router = useRouter();

  const tabs: { key: TabType; label: string; icon: typeof Terminal; count?: number }[] = [
    { key: 'logs', label: 'Logs', icon: Terminal },
    { key: 'containers', label: `Container (${project.containers?.length || 0})`, icon: Box },
    { key: 'databases', label: `Database (${projectDatabases.length})`, icon: Database },
    { key: 'uploads', label: `Upload Temp (${tempFiles.length})`, icon: Upload },
    { key: 'team', label: `Team (${project.members?.length || 0})`, icon: Users },
    { key: 'env', label: 'Variabili Env', icon: Settings },
  ];

  return (
    <>
      {/* Tabs Navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onTabChange(key)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border dark:hover:text-muted-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'logs' && (
        <LogsViewer
          projectId={projectId}
          containers={project.containers || []}
          autoRefresh={project.status === 'ACTIVE'}
        />
      )}

      {activeTab === 'containers' && (
        <ContainersTabContent project={project} />
      )}

      {activeTab === 'databases' && (
        <DatabasesTabContent projectDatabases={projectDatabases} copiedText={copiedText} onCopy={onCopy} />
      )}

      {activeTab === 'uploads' && (
        <UploadsTabContent
          project={project}
          tempFiles={tempFiles}
          copiedText={copiedText}
          uploadLoading={uploadLoading}
          onFileUpload={onFileUpload}
          onDeleteFile={onDeleteFile}
          onClearAllFiles={onClearAllFiles}
          onCopy={onCopy}
        />
      )}

      {activeTab === 'team' && (
        <ProjectMembersTab projectId={projectId} isAdmin={isAdmin} />
      )}

      {activeTab === 'env' && (
        <EnvironmentVariablesTab projectId={projectId} />
      )}
    </>
  );
}

// --- Tab Content Components ---

function ContainersTabContent({ project }: { project: any }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Container del Progetto</h3>
          <Badge variant="info">
            {project.containers?.filter((c: any) => c.status === 'RUNNING').length || 0} / {project.containers?.length || 0} attivi
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {project.containers && project.containers.length > 0 ? (
          <div className="space-y-4">
            {project.containers.map((container: any) => (
              <div key={container.id} className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${container.status === 'RUNNING' ? 'bg-success/15' : 'bg-muted'}`}>
                      <Box className={`h-5 w-5 ${container.status === 'RUNNING' ? 'text-success' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{container.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        {container.image}
                      </p>
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(container.status)}>{container.status}</Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-success" />
                    <div>
                      <p className="text-xs text-muted-foreground">Stato</p>
                      <p className="text-sm font-medium text-foreground">{container.status === 'RUNNING' ? 'Attivo' : 'Fermo'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-purple-500" />
                    <div>
                      <p className="text-xs text-muted-foreground">Immagine</p>
                      <p className="text-sm font-medium text-foreground truncate max-w-[120px]" title={container.image}>
                        {container.image.split(':')[0].split('/').pop()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-warning" />
                    <div>
                      <p className="text-xs text-muted-foreground">Docker ID</p>
                      <p className="text-sm font-medium text-foreground font-mono">
                        {container.dockerId?.substring(0, 12) || container.id.substring(0, 8)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Box className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nessun container trovato per questo progetto</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DatabasesTabContent({ projectDatabases, copiedText, onCopy }: {
  projectDatabases: any[]; copiedText: string | null; onCopy: (text: string, label: string) => void;
}) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Database del Progetto</h3>
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/databases')}>
            Gestisci Tutti
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {projectDatabases.length > 0 ? (
          <div className="space-y-4">
            {projectDatabases.map((db) => (
              <div key={db.id} className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Database className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{db.name}</p>
                      <p className="text-sm text-muted-foreground">{db.databaseName}</p>
                    </div>
                  </div>
                  <Badge variant={db.type === 'POSTGRESQL' ? 'success' : db.type === 'MYSQL' ? 'info' : 'default'}>
                    {db.type}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between p-2 bg-card rounded">
                    <div>
                      <p className="text-xs text-muted-foreground">Host</p>
                      <p className="text-sm font-mono text-foreground">{db.host}:{db.port}</p>
                    </div>
                    <button onClick={() => onCopy(`${db.host}:${db.port}`, `host-${db.id}`)} className="p-1 hover:bg-muted hover:bg-accent rounded">
                      {copiedText === `host-${db.id}` ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-card rounded">
                    <div>
                      <p className="text-xs text-muted-foreground">Username</p>
                      <p className="text-sm font-mono text-foreground">{db.username}</p>
                    </div>
                    <button onClick={() => onCopy(db.username, `user-${db.id}`)} className="p-1 hover:bg-muted hover:bg-accent rounded">
                      {copiedText === `user-${db.id}` ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <a
                    href={getAdminerUrl(db)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Apri in Adminer
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nessun database associato a questo progetto</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push('/dashboard/databases')}>
              Crea Database
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UploadsTabContent({ project, tempFiles, copiedText, uploadLoading, onFileUpload, onDeleteFile, onClearAllFiles, onCopy }: {
  project: any; tempFiles: any[]; copiedText: string | null; uploadLoading: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteFile: (filename: string) => void; onClearAllFiles: () => void;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">File Temporanei</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Carica file temporanei da usare durante lo sviluppo. Puoi eliminarli dopo l'implementazione.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tempFiles.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClearAllFiles}
                className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Pulisci Tutto
              </Button>
            )}
            <label className="cursor-pointer">
              <input type="file" multiple onChange={onFileUpload} className="hidden" accept="*/*" />
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors text-sm font-medium">
                <Upload className="h-4 w-4" />
                {uploadLoading ? 'Caricamento...' : 'Carica File'}
              </div>
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Upload Drop Zone */}
        <div
          className="border-2 border-dashed border-border rounded-lg p-8 mb-6 text-center hover:border-primary transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files.length > 0) {
              const input = document.createElement('input');
              input.type = 'file';
              input.files = files;
              onFileUpload({ target: input } as any);
            }
          }}
        >
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            Trascina i file qui o <span className="text-primary">clicca per caricare</span>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Supporta qualsiasi tipo di file, senza limiti di dimensione
          </p>
        </div>

        {/* Files List */}
        {tempFiles.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">{tempFiles.length} file caricati</span>
              <span className="text-xs text-muted-foreground">Path: /temp-uploads/</span>
            </div>
            {tempFiles.map((file, idx) => {
              const FileIcon = getFileIcon(file.name);
              return (
                <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-card rounded-lg border border-border">
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} • {new Date(file.modified).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onCopy(`/var/www/projects/${project?.path?.split('/').pop()}/temp-uploads/${file.name}`, `file-${idx}`)}
                      className="p-2 hover:bg-muted hover:bg-accent rounded-lg transition-colors"
                      title="Copia path"
                    >
                      {copiedText === `file-${idx}` ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <button
                      onClick={() => onDeleteFile(file.name)}
                      className="p-2 hover:bg-destructive/20 hover:bg-destructive/20 rounded-lg transition-colors text-destructive"
                      title="Elimina"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <File className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nessun file temporaneo caricato</p>
            <p className="text-sm mt-2">Carica immagini, video o documenti per usarli durante lo sviluppo</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
