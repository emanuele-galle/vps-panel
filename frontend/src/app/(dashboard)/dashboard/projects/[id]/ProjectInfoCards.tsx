'use client';

import {
  Server,
  Globe,
  Calendar,
  ExternalLink,
  User,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getTemplateLabel } from './utils';

interface ProjectInfoCardsProps {
  project: any;
  onSwitchToTeamTab: () => void;
}

export function ProjectInfoCards({ project, onSwitchToTeamTab }: ProjectInfoCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Basic Info Card */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-foreground">
            Informazioni Progetto
          </h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Server className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Template</p>
              <p className="font-medium text-foreground">
                {getTemplateLabel(project.template)}
              </p>
            </div>
          </div>

          {project.description && (
            <div>
              <p className="text-sm text-muted-foreground">Descrizione</p>
              <p className="text-foreground mt-1">{project.description}</p>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Creato</p>
              <p className="font-medium text-foreground">
                {new Date(project.createdAt).toLocaleDateString('it-IT', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Access Info Card */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-foreground">
            Informazioni Accesso
          </h3>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.previewUrl && (
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">URL Anteprima</p>
                <a
                  href={`https://${project.previewUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium flex items-center gap-1 mt-1"
                >
                  <span className="truncate">{project.previewUrl}</span>
                  <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                </a>
              </div>
            </div>
          )}

          {project.domains && project.domains.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Domini Personalizzati</p>
              <div className="space-y-1">
                {project.domains.map((domain: any) => (
                  <div key={domain.id} className="flex items-center justify-between">
                    <a
                      href={`https://${domain.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      {domain.domain}
                    </a>
                    <Badge variant={domain.sslEnabled ? 'success' : 'warning'}>
                      {domain.sslEnabled ? 'SSL' : 'No SSL'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Staff Assegnato Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Staff Assegnato</h3>
            <Badge variant="info">{project.members?.length || 0}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {project.members && project.members.length > 0 ? (
            project.members.slice(0, 3).map((member: any) => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="p-1.5 bg-primary/15 rounded-full">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {member.user?.name || 'Utente'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.user?.email}
                  </p>
                </div>
                <Badge variant={member.role === 'OWNER' ? 'success' : 'info'} className="text-xs">
                  {member.role === 'OWNER' ? 'Owner' : 'Membro'}
                </Badge>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nessuno staff assegnato</p>
              <p className="text-xs mt-1">Vai al tab Team per aggiungere membri</p>
            </div>
          )}
          {project.members && project.members.length > 3 && (
            <button
              onClick={onSwitchToTeamTab}
              className="w-full text-center text-sm text-primary hover:underline pt-2"
            >
              +{project.members.length - 3} altri membri →
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
