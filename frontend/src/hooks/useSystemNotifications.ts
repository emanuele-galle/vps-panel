'use client';

import { useEffect, useRef } from 'react';
import { notify } from '@/store/notificationStore';
import { useProjectsStore } from '@/store/projectsStore';

/**
 * Sistema di tracking notifiche per evitare duplicati.
 * Salva hash delle notifiche già mostrate in localStorage.
 */
const NOTIFICATION_HISTORY_KEY = 'vps-notification-history';
const HISTORY_RETENTION_DAYS = 7;

interface NotificationRecord {
  hash: string;
  timestamp: number;
}

function getNotificationHistory(): NotificationRecord[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const data = localStorage.getItem(NOTIFICATION_HISTORY_KEY);
    if (!data) return [];
    
    const history: NotificationRecord[] = JSON.parse(data);
    const cutoff = Date.now() - (HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    
    // Pulizia automatica record vecchi
    const cleaned = history.filter(record => record.timestamp > cutoff);
    
    // Se ho pulito qualcosa, aggiorno localStorage
    if (cleaned.length < history.length) {
      localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(cleaned));
    }
    
    return cleaned;
  } catch {
    return [];
  }
}

function hasNotificationBeenShown(hash: string): boolean {
  const history = getNotificationHistory();
  return history.some(record => record.hash === hash);
}

function markNotificationAsShown(hash: string): void {
  if (typeof window === 'undefined') return;
  
  const history = getNotificationHistory();
  history.push({ hash, timestamp: Date.now() });
  
  try {
    localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save notification history:', e);
  }
}

function createNotificationHash(projectId: string, type: string, status: string): string {
  return `${projectId}-${type}-${status}`;
}

/**
 * Hook che ascolta gli eventi di sistema e crea notifiche automatiche.
 * Deve essere chiamato una sola volta nel layout principale.
 */
export function useSystemNotifications() {
  const initialized = useRef(false);
  const { projects } = useProjectsStore();
  const prevProjectsRef = useRef(projects);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    // Inizializza solo una volta
    if (initialized.current) return;
    initialized.current = true;

    // Notifica di benvenuto (solo alla prima visita)
    const hasSeenWelcome = localStorage.getItem('vps-welcome-seen');
    if (!hasSeenWelcome) {
      setTimeout(() => {
        notify.info(
          'Benvenuto nella VPS Console',
          'Gestisci progetti, container, database e molto altro da un unico pannello.',
          { label: 'Vai alla Dashboard', href: '/dashboard' }
        );
        localStorage.setItem('vps-welcome-seen', 'true');
      }, 2000);
    }
  }, []);

  // Monitora cambiamenti stato progetti
  useEffect(() => {
    // Skip al primo caricamento per evitare falsi positivi
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      prevProjectsRef.current = projects;
      return;
    }

    const prevProjects = prevProjectsRef.current;

    projects.forEach((project) => {
      const prevProject = prevProjects.find((p) => p.id === project.id);

      if (prevProject) {
        // Notifica cambio stato (solo se REALMENTE cambiato)
        if (prevProject.status !== project.status) {
          const hash = createNotificationHash(project.id, 'status-change', project.status);
          
          // Controlla se questa notifica è già stata mostrata
          if (hasNotificationBeenShown(hash)) {
            return;
          }

          // Crea notifica in base al nuovo stato
          if (project.status === 'ACTIVE') {
            notify.success(
              'Progetto Attivato',
              `Il progetto "${project.name}" è ora attivo.`,
              { label: 'Visualizza', href: `/dashboard/projects/${project.id}` }
            );
          } else if (project.status === 'INACTIVE') {
            notify.warning(
              'Progetto Disattivato',
              `Il progetto "${project.name}" è stato disattivato.`,
              { label: 'Visualizza', href: `/dashboard/projects/${project.id}` }
            );
          } else if (project.status === 'ERROR') {
            notify.error(
              'Errore Progetto',
              `Il progetto "${project.name}" ha riscontrato un errore.`,
              { label: 'Dettagli', href: `/dashboard/projects/${project.id}` }
            );
          } else if (project.status === 'ARCHIVED') {
            notify.info(
              'Progetto Archiviato',
              `Il progetto "${project.name}" è stato archiviato.`,
              { label: 'Visualizza', href: `/dashboard/projects/${project.id}` }
            );
          }

          // Marca come mostrata
          markNotificationAsShown(hash);
        }
      }
    });

    // Notifica nuovo progetto
    const newProjects = projects.filter(
      (p) => !prevProjects.find((pp) => pp.id === p.id)
    );
    
    newProjects.forEach((project) => {
      const hash = createNotificationHash(project.id, 'new-project', 'created');
      
      // Controlla se questa notifica è già stata mostrata
      if (hasNotificationBeenShown(hash)) {
        return;
      }

      notify.success(
        'Nuovo Progetto',
        `Il progetto "${project.name}" è stato creato.`,
        { label: 'Apri', href: `/dashboard/projects/${project.id}` }
      );

      // Marca come mostrata
      markNotificationAsShown(hash);
    });

    prevProjectsRef.current = projects;
  }, [projects]);
}
