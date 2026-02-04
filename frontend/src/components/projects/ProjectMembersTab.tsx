'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Users, Trash2, Shield, User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PageLoader } from '@/components/ui/loading-skeleton';
import { getErrorMessage } from '@/lib/errors';
import { logComponentError } from '@/lib/logger';
import { fadeInUp, staggerContainerFast } from '@/lib/motion';

// Types
interface Member {
  id: string;
  role: MemberRole;
  user: {
    id: string;
    name: string;
    email: string;
    role?: string;
  };
  createdAt: string;
}

interface AvailableStaff {
  id: string;
  name: string;
  email: string;
}

interface ProjectMembersTabProps {
  projectId: string;
  isAdmin: boolean;
}

type MemberRole = 'OWNER' | 'MEMBER';
type BadgeVariant = 'default' | 'success' | 'info';

// Constants
const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: 'Proprietario',
  MEMBER: 'Membro',
};

const ROLE_BADGE_VARIANTS: Record<MemberRole, BadgeVariant> = {
  OWNER: 'success',
  MEMBER: 'info',
};

// Helper functions
function getRoleLabel(role: MemberRole): string {
  return ROLE_LABELS[role] || role;
}

function getRoleBadgeVariant(role: MemberRole): BadgeVariant {
  return ROLE_BADGE_VARIANTS[role] || 'default';
}

// API functions
async function fetchAPI<T>(url: string, options?: RequestInit): Promise<T | null> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Send HttpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error?.message || 'Errore di rete');
  }

  const data = await response.json();
  return data.data || null;
}

export function ProjectMembersTab({ projectId, isAdmin }: ProjectMembersTabProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [availableStaff, setAvailableStaff] = useState<AvailableStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<MemberRole>('MEMBER');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const fetchMembers = useCallback(async () => {
    try {
      const data = await fetchAPI<Member[]>(apiUrl + '/projects/' + projectId + '/members');
      setMembers(data || []);
    } catch (error: unknown) {
      logComponentError(error, 'ProjectMembersTab', 'fetchMembers');
    }
  }, [apiUrl, projectId]);

  const fetchAvailableStaff = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const data = await fetchAPI<AvailableStaff[]>(apiUrl + '/projects/' + projectId + '/available-staff');
      setAvailableStaff(data || []);
    } catch (error: unknown) {
      logComponentError(error, 'ProjectMembersTab', 'fetchAvailableStaff');
    }
  }, [apiUrl, projectId, isAdmin]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchMembers(), fetchAvailableStaff()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchMembers, fetchAvailableStaff]);

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    const staffToAdd = availableStaff.find(s => s.id === selectedUserId);
    if (!staffToAdd) return;

    setActionLoading('add');

    // Optimistic update
    setAvailableStaff(prev => prev.filter(s => s.id !== selectedUserId));
    const savedUserId = selectedUserId;
    const savedRole = selectedRole;
    setSelectedUserId('');

    try {
      await fetchAPI(apiUrl + '/projects/' + projectId + '/members', {
        method: 'POST',
        body: JSON.stringify({
          userId: savedUserId,
          role: savedRole
        })
      });

      await fetchMembers();
      setIsAddingMember(false);
      toast.success('Membro aggiunto', {
        description: staffToAdd.name + ' è stato aggiunto al team del progetto'
      });
    } catch (error: unknown) {
      // Rollback optimistic update
      setAvailableStaff(prev => [...prev, staffToAdd]);
      const message = getErrorMessage(error);
      logComponentError(error, 'ProjectMembersTab', 'addMember');
      toast.error('Errore', { description: message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    setActionLoading(memberId);
    try {
      await fetchAPI(apiUrl + '/projects/' + projectId + '/members/' + memberId, {
        method: 'DELETE'
      });

      await Promise.all([fetchMembers(), fetchAvailableStaff()]);
      toast.success('Membro rimosso', {
        description: memberName + ' è stato rimosso dal team'
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logComponentError(error, 'ProjectMembersTab', 'removeMember');
      toast.error('Errore', { description: message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: MemberRole) => {
    setActionLoading(memberId);
    try {
      await fetchAPI(apiUrl + '/projects/' + projectId + '/members/' + memberId, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole })
      });

      await fetchMembers();
      toast.success('Ruolo aggiornato', {
        description: 'Il ruolo è stato cambiato in ' + getRoleLabel(newRole)
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      logComponentError(error, 'ProjectMembersTab', 'updateRole');
      toast.error('Errore', { description: message });
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <PageLoader message="Caricamento team..." />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">
              Team del Progetto
            </h3>
            <Badge variant="info" className="badge-info">
              {members.length} membri
            </Badge>
          </div>
          {isAdmin && !isAddingMember && availableStaff.length > 0 && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingMember(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Aggiungi Membro
              </Button>
            </motion.div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Add Member Form */}
        <AnimatePresence>
          {isAdmin && isAddingMember && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 bg-primary/5 rounded-xl border border-primary/20"
            >
              <h4 className="font-medium mb-3">
                Aggiungi un membro dello staff al progetto
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona utente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStaff.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.name} ({staff.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as MemberRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Membro</SelectItem>
                    <SelectItem value="OWNER">Proprietario</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Button
                    onClick={handleAddMember}
                    disabled={!selectedUserId || actionLoading === 'add'}
                    className="flex-1"
                  >
                    {actionLoading === 'add' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Aggiungi'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddingMember(false);
                      setSelectedUserId('');
                    }}
                  >
                    Annulla
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Members List */}
        {members.length > 0 ? (
          <motion.div
            className="space-y-3"
            variants={staggerContainerFast}
            initial="hidden"
            animate="visible"
          >
            <AnimatePresence mode="popLayout">
              {members.map((member, index) => (
                <motion.div
                  key={member.id}
                  variants={fadeInUp}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full border">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {member.user.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isAdmin ? (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(v) => handleUpdateRole(member.user.id, v as MemberRole)}
                          disabled={actionLoading === member.user.id}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MEMBER">Membro</SelectItem>
                            <SelectItem value="OWNER">Proprietario</SelectItem>
                          </SelectContent>
                        </Select>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionLoading === member.user.id}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              {actionLoading === member.user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Rimuovere {member.user.name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Questa azione rimuoverà {member.user.name} dal team del progetto.
                                L&apos;utente perderà l&apos;accesso a questo progetto e alle sue risorse.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                Annulla
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveMember(member.user.id, member.user.name)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Rimuovi
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    ) : (
                      <Badge
                        variant={getRoleBadgeVariant(member.role)}
                        className={member.role === 'OWNER' ? 'badge-success' : 'badge-info'}
                      >
                        {getRoleLabel(member.role)}
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted border flex items-center justify-center">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-3">Nessun membro aggiunto a questo progetto</p>
            {isAdmin && availableStaff.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingMember(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Aggiungi il primo membro
              </Button>
            )}
            {isAdmin && availableStaff.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Crea prima degli utenti staff per poterli assegnare
              </p>
            )}
          </motion.div>
        )}

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 p-4 bg-amber-500/5 rounded-xl border border-amber-500/20"
        >
          <div className="flex items-start gap-2">
            <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1 text-amber-700 dark:text-amber-400">Ruoli e Permessi</p>
              <ul className="space-y-1 text-amber-600/80 dark:text-amber-400/70">
                <li><strong className="text-amber-700 dark:text-amber-400">Membro:</strong> Può vedere e lavorare sul progetto</li>
                <li><strong className="text-amber-700 dark:text-amber-400">Proprietario:</strong> Controllo completo sul progetto</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}
