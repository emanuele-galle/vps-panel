'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { backupsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useProjectsStore } from '@/store/projectsStore';
import { useDatabasesStore } from '@/store/databasesStore';
import { useAuthStore } from '@/store/authStore';
import { ProjectHeader } from './ProjectHeader';
import { QuickToolsBar } from './QuickToolsBar';
import { ProjectInfoCards } from './ProjectInfoCards';
import { ProjectCredentials } from './ProjectCredentials';
import { ProjectTabs, type TabType } from './ProjectTabs';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const {
    currentProject,
    isLoading,
    error,
    fetchProject,
    startProject,
    stopProject,
    restartProject,
    deleteProject,
  } = useProjectsStore();

  const { databases, fetchDatabases } = useDatabasesStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [actionLoading, setActionLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [showPasswords, setShowPasswords] = useState(false);
  const [tempFiles, setTempFiles] = useState<any[]>([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const projectDatabases = databases.filter(db => db.projectId === projectId);

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
      fetchDatabases({ projectId });
      fetchTempFiles();
    }
  }, [projectId, fetchProject, fetchDatabases]);

  const fetchTempFiles = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/temp-files`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setTempFiles(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch temp files:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadLoading(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/temp-files`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (res.ok) {
        await fetchTempFiles();
      }
    } catch (error) {
      console.error('Failed to upload files:', error);
    } finally {
      setUploadLoading(false);
      e.target.value = '';
    }
  };

  const handleDeleteFile = async (filename: string) => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/temp-files/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await fetchTempFiles();
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const handleClearAllFiles = async () => {
    if (!confirm('Sei sicuro di voler eliminare tutti i file temporanei?')) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/temp-files`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await fetchTempFiles();
    } catch (error) {
      console.error('Failed to clear files:', error);
    }
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await startProject(projectId);
      await fetchProject(projectId);
    } catch (error: any) {
      console.error('Failed to start project:', error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await stopProject(projectId);
      await fetchProject(projectId);
    } catch (error: any) {
      console.error('Failed to stop project:', error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    setActionLoading(true);
    try {
      await restartProject(projectId);
      await fetchProject(projectId);
    } catch (error: any) {
      console.error('Failed to restart project:', error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Sei sicuro di voler eliminare "${currentProject?.name}"? Questa azione non può essere annullata.`)) {
      return;
    }

    setActionLoading(true);
    try {
      await deleteProject(projectId);
      router.push('/dashboard/projects');
    } catch (error: any) {
      console.error('Failed to delete project:', error.message);
      setActionLoading(false);
    }
  };

  const handleExportBackup = async () => {
    setExportLoading(true);

    toast.loading('Creazione backup in corso...', {
      id: 'export-backup',
      description: 'Include file del progetto e database. Potrebbe richiedere alcuni minuti.',
    });

    try {
      const response = await backupsApi.exportProject(projectId);

      if (response.data.success && response.data.data) {
        const { downloadUrl, backup } = response.data.data;

        toast.success('Backup creato con successo!', {
          id: 'export-backup',
          description: `File: ${backup.filename}`,
          action: {
            label: 'Scarica',
            onClick: () => {
              window.open(`${process.env.NEXT_PUBLIC_API_URL}${downloadUrl}`, '_blank');
            },
          },
          duration: 10000,
        });

        window.open(`${process.env.NEXT_PUBLIC_API_URL}${downloadUrl}`, '_blank');
      }
    } catch (error: any) {
      console.error('Failed to export backup:', error);
      toast.error('Errore durante la creazione del backup', {
        id: 'export-backup',
        description: error.message || 'Riprova più tardi',
      });
    } finally {
      setExportLoading(false);
    }
  };

  if (isLoading && !currentProject) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-border border-t-blue-600"></div>
          <p className="text-muted-foreground mt-4">Caricamento progetto...</p>
        </div>
      </div>
    );
  }

  if (error && !currentProject) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md">
          <div className="bg-destructive/10 border border-destructive/30 text-destructive px-6 py-4 rounded-lg">
            <p className="font-semibold">Errore caricamento progetto</p>
            <p className="text-sm mt-2">{error}</p>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard/projects')}
              className="mt-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Torna ai Progetti
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return null;
  }

  return (
    <div className="space-y-6">
      <ProjectHeader
        project={currentProject}
        actionLoading={actionLoading}
        onStart={handleStart}
        onStop={handleStop}
        onRestart={handleRestart}
        onDelete={handleDelete}
      />

      <QuickToolsBar
        project={currentProject}
        projectDatabases={projectDatabases}
        exportLoading={exportLoading}
        isLoading={isLoading}
        onExportBackup={handleExportBackup}
        onRefresh={() => fetchProject(projectId)}
      />

      <ProjectInfoCards
        project={currentProject}
        onSwitchToTeamTab={() => setActiveTab('team')}
      />

      <ProjectCredentials
        project={currentProject}
        projectDatabases={projectDatabases}
        showPasswords={showPasswords}
        copiedText={copiedText}
        isLoading={isLoading}
        onTogglePasswords={() => setShowPasswords(!showPasswords)}
        onCopy={handleCopy}
        onRefresh={() => fetchProject(projectId)}
      />

      <ProjectTabs
        project={currentProject}
        projectId={projectId}
        projectDatabases={projectDatabases}
        activeTab={activeTab}
        tempFiles={tempFiles}
        copiedText={copiedText}
        uploadLoading={uploadLoading}
        isAdmin={isAdmin}
        onTabChange={setActiveTab}
        onFileUpload={handleFileUpload}
        onDeleteFile={handleDeleteFile}
        onClearAllFiles={handleClearAllFiles}
        onCopy={handleCopy}
      />
    </div>
  );
}
