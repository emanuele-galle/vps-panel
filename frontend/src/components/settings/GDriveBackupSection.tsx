"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Cloud,
  Database,
  Shield,
  Loader2,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  HardDrive,
  FolderOpen,
  Calendar,
  Play,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import api from "@/lib/api";
import { gdriveBackupFolder } from "@/lib/env";

interface BackupJob {
  id: string;
  type: "databases" | "full-system";
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
}

interface BackupSchedule {
  type: string;
  description: string;
  schedule: string;
  destination: string;
  name: string;
  active: boolean;
  nextRun: string | null;
}

interface GDriveFile {
  name: string;
  size: number;
  modified: string;
  isDir: boolean;
}

export function GDriveBackupSection() {
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [gdriveFiles, setGdriveFiles] = useState<GDriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [currentFolder, setCurrentFolder] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [triggeringBackup, setTriggeringBackup] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await api.get("/gdrive-backup/jobs");
      if (response.data.success) {
        setJobs(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching jobs:", err);
    }
  }, []);

  const fetchSchedule = useCallback(async () => {
    try {
      const response = await api.get("/gdrive-backup/schedule");
      if (response.data.success) {
        setSchedules(response.data.data.schedules);
      }
    } catch (err) {
      console.error("Error fetching schedule:", err);
    }
  }, []);

  const fetchGDriveFiles = useCallback(async (folder: string = "") => {
    setIsLoadingFiles(true);
    try {
      const response = await api.get("/gdrive-backup/gdrive", {
        params: { folder },
      });
      if (response.data.success) {
        setGdriveFiles(response.data.data.files);
        setCurrentFolder(folder);
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.error?.message || "Errore caricamento file Google Drive",
      });
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchJobs(), fetchSchedule(), fetchGDriveFiles()]);
      setIsLoading(false);
    };
    loadData();

    pollingRef.current = setInterval(() => {
      fetchJobs();
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchJobs, fetchSchedule, fetchGDriveFiles]);

  const triggerBackup = async (type: "databases" | "full-system") => {
    setTriggeringBackup(type);
    setMessage(null);
    try {
      const response = await api.post(`/gdrive-backup/${type}`);
      if (response.data.success) {
        setMessage({
          type: "success",
          text: `Backup ${type === "databases" ? "database" : "completo"} avviato su Google Drive`,
        });
        await fetchJobs();
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.error?.message || "Errore durante l'avvio del backup",
      });
    } finally {
      setTriggeringBackup(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const runningJobs = jobs.filter((j) => j.status === "running");
  const recentJobs = jobs.filter((j) => j.status !== "running").slice(0, 5);

  return (
    <div className="space-y-6">
      <Card className="border-success/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-success" />
            <p className="font-medium text-success">
              Google Drive connesso correttamente
            </p>
          </div>
        </CardContent>
      </Card>

      {message && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-success/10 border border-success/30"
              : "bg-destructive/10 border border-destructive/30"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
          <p
            className={
              message.type === "success"
                ? "text-success"
                : "text-destructive"
            }
          >
            {message.text}
          </p>
        </div>
      )}

      {runningJobs.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Backup in corso
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {runningJobs.map((job) => (
                <div key={job.id} className="bg-primary/10 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-primary">
                      {job.type === "databases" ? "Backup Database" : "Backup Completo Sistema"}
                    </span>
                    <Badge>In corso</Badge>
                  </div>
                  <Progress value={undefined} className="h-2 mb-2" />
                  <p className="text-xs text-primary">
                    Avviato: {formatDate(job.startedAt)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/15 rounded-lg">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Backup Database
                </h3>
                <p className="text-sm text-muted-foreground">
                  PostgreSQL e MySQL su Google Drive
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => triggerBackup("databases")}
              disabled={triggeringBackup !== null || runningJobs.length > 0}
              className="w-full"
            >
              {triggeringBackup === "databases" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Avvio...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Avvia Backup Database
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-warning/15 rounded-lg">
                <Shield className="h-6 w-6 text-warning" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Backup Completo
                </h3>
                <p className="text-sm text-muted-foreground">
                  Sistema completo su Google Drive
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => triggerBackup("full-system")}
              disabled={triggeringBackup !== null || runningJobs.length > 0}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              {triggeringBackup === "full-system" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Avvio...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Avvia Backup Completo
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Backup Programmati
                </h3>
                <p className="text-sm text-muted-foreground">
                  Esecuzione automatica via systemd timer
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSchedule}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Aggiorna
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {schedules.map((schedule, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">
                      {schedule.description}
                    </h4>
                    <Badge variant={schedule.active ? "success" : "default"}>
                      {schedule.active ? "Attivo" : "Inattivo"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {schedule.schedule}
                  </p>
                  {schedule.nextRun && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Prossima esecuzione: {schedule.nextRun}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    <Cloud className="h-3 w-3 inline mr-1" />
                    {schedule.destination}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  File su Google Drive
                </h3>
                <p className="text-sm text-muted-foreground">
                  {gdriveBackupFolder}/{currentFolder || "/"}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchGDriveFiles(currentFolder)} disabled={isLoadingFiles}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingFiles ? "animate-spin" : ""}`} />
              Aggiorna
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingFiles ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : gdriveFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nessun file trovato</p>
            </div>
          ) : (
            <div className="space-y-2">
              {currentFolder && (
                <button
                  onClick={() => {
                    const parentFolder = currentFolder.split("/").slice(0, -2).join("/");
                    fetchGDriveFiles(parentFolder);
                  }}
                  className="text-primary text-sm hover:underline mb-2"
                >
                  ← Torna indietro
                </button>
              )}
              {gdriveFiles.map((file, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    file.isDir
                      ? "bg-primary/10 cursor-pointer hover:bg-primary/20"
                      : "bg-muted/50"
                  }`}
                  onClick={() => {
                    if (file.isDir) {
                      const newPath = currentFolder ? `${currentFolder}${file.name}` : file.name;
                      fetchGDriveFiles(newPath);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    {file.isDir ? (
                      <FolderOpen className="h-4 w-4 text-primary" />
                    ) : (
                      <HardDrive className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {file.name}
                      </p>
                      {!file.isDir && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>{formatBytes(file.size)}</span>
                          <span>{file.modified}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {recentJobs.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-foreground">
              Backup Recenti
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {job.type === "databases" ? "Backup Database" : "Backup Completo"}
                      </span>
                      <Badge variant={job.status === "completed" ? "success" : "error"}>
                        {job.status === "completed" ? "Completato" : "Fallito"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {formatDate(job.startedAt)}
                      {job.duration && ` • ${formatDuration(job.duration)}`}
                    </div>
                    {job.error && (
                      <p className="text-xs text-destructive mt-1">{job.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
// Cache bust: 1764683470
