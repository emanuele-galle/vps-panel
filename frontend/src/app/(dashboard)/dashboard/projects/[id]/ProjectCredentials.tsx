'use client';

import {
  ExternalLink,
  Globe,
  User,
  FolderOpen,
  Database,
  Terminal,
  Copy,
  Check,
  Key,
  Eye,
  EyeOff,
  Store,
  Link2,
  Palette,
  HardDrive,
  Server,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getFileBrowserUrl, getAdminerUrl } from './utils';
import { panelDomain } from '@/lib/env';

interface ProjectCredentialsProps {
  project: any;
  projectDatabases: any[];
  showPasswords: boolean;
  copiedText: string | null;
  isLoading: boolean;
  onTogglePasswords: () => void;
  onCopy: (text: string, label: string) => void;
  onRefresh: () => void;
}

export function ProjectCredentials({
  project,
  projectDatabases,
  showPasswords,
  copiedText,
  isLoading,
  onTogglePasswords,
  onCopy,
  onRefresh,
}: ProjectCredentialsProps) {
  return (
    <>
      {/* Demo Credentials Card */}
      <DemoCredentialsCard
        project={project}
        showPasswords={showPasswords}
        copiedText={copiedText}
        isLoading={isLoading}
        onTogglePasswords={onTogglePasswords}
        onCopy={onCopy}
        onRefresh={onRefresh}
      />

      {/* URLs Section */}
      {project.credentials?.urls && Object.keys(project.credentials.urls).length > 0 && (
        <UrlsCard project={project} copiedText={copiedText} onCopy={onCopy} />
      )}

      {/* Studios Demo Section */}
      {project.credentials?.studios && Object.keys(project.credentials.studios).length > 0 && (
        <StudiosCard project={project} />
      )}

      {/* Templates Section */}
      {project.credentials?.templates && (project.credentials.templates as any[]).length > 0 && (
        <TemplatesCard project={project} />
      )}

      {/* Services Section */}
      {project.credentials?.services && Object.keys(project.credentials.services).length > 0 && (
        <ServicesCard
          project={project}
          showPasswords={showPasswords}
          copiedText={copiedText}
          onTogglePasswords={onTogglePasswords}
          onCopy={onCopy}
        />
      )}

      {/* PM2 Processes Section */}
      {project.credentials?.pm2 && (project.credentials.pm2 as any[]).length > 0 && (
        <PM2ProcessesCard project={project} />
      )}

      {/* Notes Section */}
      {project.credentials?.notes && (
        <div className="p-4 bg-warning/10 bg-warning/10 border border-warning/30 rounded-lg">
          <p className="text-sm text-warning">
            <strong>Note:</strong> {project.credentials.notes as string}
          </p>
        </div>
      )}

      {/* Infrastructure Credentials */}
      <InfrastructureCredentialsCard
        project={project}
        projectDatabases={projectDatabases}
        showPasswords={showPasswords}
        copiedText={copiedText}
        onTogglePasswords={onTogglePasswords}
        onCopy={onCopy}
      />
    </>
  );
}

// --- Sub-components ---

function CopyButton({ text, label, copiedText, onCopy }: { text: string; label: string; copiedText: string | null; onCopy: (text: string, label: string) => void }) {
  return (
    <button onClick={() => onCopy(text, label)} className="p-1 hover:bg-muted hover:bg-accent rounded">
      {copiedText === label ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

function DemoCredentialsCard({ project, showPasswords, copiedText, isLoading, onTogglePasswords, onCopy, onRefresh }: {
  project: any; showPasswords: boolean; copiedText: string | null; isLoading: boolean;
  onTogglePasswords: () => void; onCopy: (text: string, label: string) => void; onRefresh: () => void;
}) {
  return (
    <Card className="border-2 border-success/30 bg-success/10 bg-success/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-success" />
            <h3 className="text-lg font-semibold text-foreground">Credenziali Demo Area Clienti</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onRefresh} disabled={isLoading} title="Aggiorna credenziali" className="text-muted-foreground hover:text-foreground">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {project.credentials && (
              <Button variant="ghost" size="sm" onClick={onTogglePasswords} className="text-muted-foreground hover:text-foreground">
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="ml-1 text-xs">{showPasswords ? 'Nascondi' : 'Mostra'}</span>
              </Button>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Account di test per accedere all'applicazione con diversi ruoli</p>
      </CardHeader>
      <CardContent>
        {project.credentials?.accounts ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(project.credentials.accounts as Record<string, { email: string; password: string; description?: string; loginUrl?: string }>).map(([role, account]) => (
                <div key={role} className="bg-card rounded-lg p-4 border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <User className={`h-5 w-5 ${
                      role.toLowerCase().includes('admin') ? 'text-destructive' :
                      role.toLowerCase().includes('staff') || role.toLowerCase().includes('notaio') ? 'text-warning' :
                      'text-success'
                    }`} />
                    <h4 className="font-semibold text-foreground capitalize">{role.replace(/_/g, ' ')}</h4>
                  </div>
                  {account.description && (
                    <p className="text-xs text-muted-foreground mb-3">{account.description}</p>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{account.email}</span>
                        <CopyButton text={account.email} label={`acc-email-${role}`} copiedText={copiedText} onCopy={onCopy} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Password:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono">{showPasswords ? account.password : '••••••••'}</span>
                        <CopyButton text={account.password} label={`acc-pass-${role}`} copiedText={copiedText} onCopy={onCopy} />
                      </div>
                    </div>
                  </div>
                  {account.loginUrl && (
                    <a href={account.loginUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Accedi come {role.replace(/_/g, ' ')}
                    </a>
                  )}
                </div>
              ))}
            </div>

            {project.credentials?.dashboardUrls && Object.keys(project.credentials.dashboardUrls).length > 0 && (
              <div className="mt-6 pt-4 border-t border-success/30">
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-success" />
                  Link Rapidi Dashboard
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(project.credentials.dashboardUrls).map(([name, url]) => (
                    <a key={name} href={url as string} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border rounded-lg text-sm text-foreground hover:border-success hover:text-success dark:hover:text-success transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                      {name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : project.credentials?.app?.demo ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {typeof project.credentials.app.demo === 'object' &&
             !('email' in project.credentials.app.demo) ? (
              Object.entries(project.credentials.app.demo as Record<string, { email: string; password: string }>).map(([demoType, demoData]) => (
                <div key={demoType} className="bg-card rounded-lg p-4 border border-border">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-5 w-5 text-success" />
                    <h4 className="font-semibold text-foreground capitalize">{demoType.replace('_', ' ')}</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Email:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{demoData.email}</span>
                        <CopyButton text={demoData.email} label={`app-email-${demoType}`} copiedText={copiedText} onCopy={onCopy} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Password:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono">{showPasswords ? demoData.password : '••••••••'}</span>
                        <CopyButton text={demoData.password} label={`app-pass-${demoType}`} copiedText={copiedText} onCopy={onCopy} />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-card rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-5 w-5 text-success" />
                  <h4 className="font-semibold text-foreground">Demo</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono">{(project.credentials!.app!.demo as any).email}</span>
                      <CopyButton text={(project.credentials!.app!.demo as any).email} label="app-email" copiedText={copiedText} onCopy={onCopy} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Password:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono">{showPasswords ? (project.credentials!.app!.demo as any).password : '••••••••'}</span>
                      <CopyButton text={(project.credentials!.app!.demo as any).password} label="app-pass" copiedText={copiedText} onCopy={onCopy} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nessuna credenziale demo configurata</p>
            <p className="text-sm mt-1">Le credenziali di accesso demo verranno mostrate qui una volta configurate</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UrlsCard({ project, copiedText, onCopy }: { project: any; copiedText: string | null; onCopy: (text: string, label: string) => void }) {
  return (
    <Card className="border-2 border-primary/30 bg-primary/10 bg-primary/10">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">URL del Progetto</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Tutti gli endpoint pubblici del progetto</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(project.credentials.urls as Record<string, { url: string; description?: string }>).map(([name, urlInfo]) => (
            <div key={name} className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-foreground capitalize">{name.replace(/_/g, ' ')}</h4>
                <a href={urlInfo.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-muted hover:bg-accent rounded">
                  <ExternalLink className="h-4 w-4 text-primary" />
                </a>
              </div>
              {urlInfo.description && (
                <p className="text-xs text-muted-foreground mb-2">{urlInfo.description}</p>
              )}
              <div className="flex items-center gap-1">
                <code className="text-xs text-primary truncate flex-1">{urlInfo.url}</code>
                <CopyButton text={urlInfo.url} label={`url-${name}`} copiedText={copiedText} onCopy={onCopy} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StudiosCard({ project }: { project: any }) {
  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-foreground">Studi Demo</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Studi di esempio configurati per test e demo</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(project.credentials.studios as Record<string, { name: string; slug: string; template: string; status: string; publicUrl?: string }>).map(([key, studio]) => (
            <div key={key} className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-foreground">{studio.name}</h4>
                  <p className="text-xs text-muted-foreground">/{studio.slug}</p>
                </div>
                <Badge variant={studio.status === 'ACTIVE' ? 'success' : studio.status === 'TRIAL' ? 'warning' : 'default'}>
                  {studio.status}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Template:</span>
                  <span className="font-medium text-purple-600 dark:text-purple-400">{studio.template.replace(/_/g, ' ')}</span>
                </div>
                {studio.publicUrl && (
                  <a href={studio.publicUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Visita Sito Pubblico
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TemplatesCard({ project }: { project: any }) {
  return (
    <Card className="border-2 border-pink-200 dark:border-pink-800 bg-pink-50/50 dark:bg-pink-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-pink-600 dark:text-pink-400" />
          <h3 className="text-lg font-semibold text-foreground">Template Disponibili</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Temi grafici selezionabili per i siti pubblici</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(project.credentials.templates as { id: string; name: string; preview?: string }[]).map((template) => (
            <div key={template.id} className="bg-card rounded-lg border border-border overflow-hidden">
              {template.preview && (
                <div className="aspect-video bg-muted relative">
                  <img src={template.preview} alt={template.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
              <div className="p-2 text-center">
                <p className="text-xs font-medium text-foreground">{template.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{template.id}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ServicesCard({ project, showPasswords, copiedText, onTogglePasswords, onCopy }: {
  project: any; showPasswords: boolean; copiedText: string | null;
  onTogglePasswords: () => void; onCopy: (text: string, label: string) => void;
}) {
  return (
    <Card className="border-2 border-cyan-200 dark:border-cyan-800 bg-cyan-50/50 dark:bg-cyan-950/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-lg font-semibold text-foreground">Servizi Aggiuntivi</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onTogglePasswords} className="text-muted-foreground hover:text-foreground">
            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Redis, MinIO e altri servizi di supporto</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(project.credentials.services as Record<string, any>).map(([serviceName, serviceInfo]) => (
            <div key={serviceName} className="bg-card rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-1.5 rounded ${serviceName === 'redis' ? 'bg-destructive/15' : serviceName === 'minio' ? 'bg-warning/15' : 'bg-muted'}`}>
                  {serviceName === 'redis' ? (
                    <Database className="h-4 w-4 text-destructive" />
                  ) : serviceName === 'minio' ? (
                    <HardDrive className="h-4 w-4 text-warning" />
                  ) : (
                    <Server className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <h4 className="font-semibold text-foreground uppercase text-sm">{serviceName}</h4>
              </div>
              <div className="space-y-1.5 text-sm">
                {serviceInfo.host && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Host:</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs">{serviceInfo.host}:{serviceInfo.port || ''}</code>
                      <CopyButton text={`${serviceInfo.host}:${serviceInfo.port}`} label={`svc-host-${serviceName}`} copiedText={copiedText} onCopy={onCopy} />
                    </div>
                  </div>
                )}
                {serviceInfo.apiPort && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">API Port:</span>
                    <code className="text-xs">{serviceInfo.apiPort}</code>
                  </div>
                )}
                {serviceInfo.consolePort && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Console Port:</span>
                    <code className="text-xs">{serviceInfo.consolePort}</code>
                  </div>
                )}
                {serviceInfo.password && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Password:</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs">{showPasswords ? serviceInfo.password : '********'}</code>
                      <CopyButton text={serviceInfo.password} label={`svc-pass-${serviceName}`} copiedText={copiedText} onCopy={onCopy} />
                    </div>
                  </div>
                )}
                {serviceInfo.accessKey && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Access Key:</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs">{showPasswords ? serviceInfo.accessKey : '********'}</code>
                      <CopyButton text={serviceInfo.accessKey} label={`svc-ak-${serviceName}`} copiedText={copiedText} onCopy={onCopy} />
                    </div>
                  </div>
                )}
                {serviceInfo.secretKey && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Secret Key:</span>
                    <div className="flex items-center gap-1">
                      <code className="text-xs">{showPasswords ? serviceInfo.secretKey : '********'}</code>
                      <CopyButton text={serviceInfo.secretKey} label={`svc-sk-${serviceName}`} copiedText={copiedText} onCopy={onCopy} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PM2ProcessesCard({ project }: { project: any }) {
  return (
    <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-lg font-semibold text-foreground">Processi PM2</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">App Node.js gestite da PM2</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(project.credentials.pm2 as { name: string; port: number; description?: string }[]).map((proc) => (
            <div key={proc.name} className="bg-card rounded-lg p-3 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground text-sm">{proc.name}</p>
                  {proc.description && (
                    <p className="text-xs text-muted-foreground">{proc.description}</p>
                  )}
                </div>
                <Badge variant="info" className="text-xs">:{proc.port}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function InfrastructureCredentialsCard({ project, projectDatabases, showPasswords, copiedText, onTogglePasswords, onCopy }: {
  project: any; projectDatabases: any[]; showPasswords: boolean; copiedText: string | null;
  onTogglePasswords: () => void; onCopy: (text: string, label: string) => void;
}) {
  return (
    <Card className="border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h3 className="text-lg font-semibold text-foreground">Credenziali Infrastruttura</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onTogglePasswords} className="text-muted-foreground hover:text-foreground">
            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="ml-1 text-xs">{showPasswords ? 'Nascondi' : 'Mostra'}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File Manager Credentials */}
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">File Manager</h4>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">URL:</span>
                <div className="flex items-center gap-1">
                  <a href={getFileBrowserUrl(project)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate max-w-[200px]">
                    {`files.${panelDomain}`}
                  </a>
                  <CopyButton text={getFileBrowserUrl(project)} label="fb-url" copiedText={copiedText} onCopy={onCopy} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Username:</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-mono text-foreground">{process.env.NEXT_PUBLIC_FILEBROWSER_USERNAME || 'admin'}</span>
                  <CopyButton text={process.env.NEXT_PUBLIC_FILEBROWSER_USERNAME || 'admin'} label="fb-user" copiedText={copiedText} onCopy={onCopy} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Password:</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-mono text-foreground">
                    {showPasswords ? (process.env.NEXT_PUBLIC_FILEBROWSER_PASSWORD || '••••••••') : '••••••••••••••'}
                  </span>
                  <CopyButton text={process.env.NEXT_PUBLIC_FILEBROWSER_PASSWORD || ''} label="fb-pass" copiedText={copiedText} onCopy={onCopy} />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                <span className="text-sm text-muted-foreground">Path Progetto:</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono text-foreground truncate max-w-[150px]" title={project?.path}>
                    {project?.path?.split('/').pop()}
                  </span>
                  <CopyButton text={project?.path || ''} label="fb-path" copiedText={copiedText} onCopy={onCopy} />
                </div>
              </div>
            </div>
          </div>

          {/* Database Credentials */}
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-5 w-5 text-purple-500" />
              <h4 className="font-semibold text-foreground">Database</h4>
            </div>
            {projectDatabases.length > 0 ? (
              <div className="space-y-2">
                {projectDatabases.map((db, idx) => (
                  <div key={db.id} className={idx > 0 ? 'pt-3 border-t border-border' : ''}>
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant={db.type === 'POSTGRESQL' ? 'success' : 'info'} className="text-xs">{db.type}</Badge>
                      <span className="text-xs text-muted-foreground">{db.databaseName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Host:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-mono text-foreground">{db.host}:{db.port}</span>
                        <CopyButton text={`${db.host}:${db.port}`} label={`db-host-${db.id}`} copiedText={copiedText} onCopy={onCopy} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">User:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-mono text-foreground">{db.username}</span>
                        <CopyButton text={db.username} label={`db-user-${db.id}`} copiedText={copiedText} onCopy={onCopy} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Password:</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-mono text-foreground">{showPasswords ? (db.password || 'N/A') : '••••••••'}</span>
                        {db.password && (
                          <CopyButton text={db.password} label={`db-pass-${db.id}`} copiedText={copiedText} onCopy={onCopy} />
                        )}
                      </div>
                    </div>
                    <div className="mt-2">
                      <a href={getAdminerUrl(db)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline">
                        <ExternalLink className="h-3 w-3" />
                        Apri in Adminer
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun database associato</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
