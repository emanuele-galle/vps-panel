'use client';

import { useEffect, useState } from 'react';
import {
  Mail,
  Plus,
  RefreshCw,
  AlertCircle,
  Cloud,
  CheckCircle,
  XCircle,
  HardDrive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmailAccountCard } from '@/components/email/EmailAccountCard';
import { CreateEmailDialog } from '@/components/email/CreateEmailDialog';
import { useEmailStore, EmailAccount } from '@/store/emailStore';
import { SMTPConfig } from '@/components/email/SMTPConfig';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function EmailPage() {
  const {
    emails,
    stats,
    isLoading,
    error,
    fetchEmails,
    fetchEmailStats,
    updateEmail,
    deleteEmail,
    changePassword,
    syncFromHostinger,
  } = useEmailStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailAccount | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    quota: '',
    forwardTo: '',
    autoReply: false,
    autoReplyMsg: '',
    isActive: true,
    clientName: '',
    notes: '',
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    fetchEmails();
    fetchEmailStats();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchEmails(), fetchEmailStats()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncFromHostinger();
      await fetchEmailStats();
    } finally {
      setSyncing(false);
    }
  };

  const handleEdit = (email: EmailAccount) => {
    setSelectedEmail(email);
    setEditFormData({
      quota: email.quota.toString(),
      forwardTo: email.forwardTo || '',
      autoReply: email.autoReply,
      autoReplyMsg: email.autoReplyMsg || '',
      isActive: email.isActive,
      clientName: email.clientName || '',
      notes: email.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmail) return;

    try {
      await updateEmail(selectedEmail.id, {
        quota: parseInt(editFormData.quota),
        forwardTo: editFormData.forwardTo || undefined,
        autoReply: editFormData.autoReply,
        autoReplyMsg: editFormData.autoReplyMsg || undefined,
        isActive: editFormData.isActive,
        clientName: editFormData.clientName || undefined,
        notes: editFormData.notes || undefined,
      });
      setIsEditDialogOpen(false);
      setSelectedEmail(null);
    } catch (error) {
      console.error('Failed to update email:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this email account?')) {
      return;
    }

    try {
      await deleteEmail(id);
    } catch (error) {
      console.error('Failed to delete email:', error);
    }
  };

  const handleChangePassword = (email: EmailAccount) => {
    setSelectedEmail(email);
    setPasswordData({ newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setIsPasswordDialogOpen(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmail) return;

    // Validation
    if (passwordData.newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      await changePassword(selectedEmail.id, passwordData.newPassword);
      setIsPasswordDialogOpen(false);
      setSelectedEmail(null);
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError((error as Error).message);
    }
  };

  const formatSize = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Account Email
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci gli account email con integrazione Hostinger
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSync} disabled={syncing} variant="outline">
            <Cloud
              className={`h-4 w-4 mr-2 ${syncing ? 'animate-pulse' : ''}`}
            />
            {syncing ? 'Sincronizzazione...' : 'Sincronizza con Hostinger'}
          </Button>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
            />
            Aggiorna
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crea Email
          </Button>
        </div>
      </div>

      {/* SMTP Configuration */}
      <SMTPConfig />

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Mail className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.total}
                </p>
                <p className="text-sm text-muted-foreground">
                  Account Totali
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.active}
                </p>
                <p className="text-sm text-muted-foreground">Attivi</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.inactive}
                </p>
                <p className="text-sm text-muted-foreground">Inattivi</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <HardDrive className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {formatSize(stats.totalQuota)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Quota Totale
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <HardDrive className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {formatSize(stats.totalUsed)}
                </p>
                <p className="text-sm text-muted-foreground">Spazio Usato</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-primary">
              Integrazione Hostinger
            </h3>
            <p className="text-sm text-primary mt-1">
              Gli account email sono gestiti tramite API Hostinger. Usa il pulsante "Sincronizza con
              Hostinger" per recuperare gli account esistenti dal tuo pannello di controllo Hostinger.
              Tutte le modifiche vengono riflesse in tempo reale sui server Hostinger.
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && emails.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 text-primary animate-spin mx-auto" />
            <p className="text-muted-foreground mt-2">
              Caricamento account email...
            </p>
          </div>
        </div>
      ) : emails.length === 0 ? (
        /* Empty State */
        <div className="bg-card border border-border rounded-lg p-12">
          <div className="text-center">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Nessun Account Email
            </h3>
            <p className="mt-2 text-muted-foreground">
              Inizia creando il tuo primo account email o sincronizzando da Hostinger
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crea Account Email
              </Button>
              <Button onClick={handleSync} variant="outline">
                <Cloud className="h-4 w-4 mr-2" />
                Sincronizza da Hostinger
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Email Accounts Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {emails.map((email) => (
            <EmailAccountCard
              key={email.id}
              email={email}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onChangePassword={handleChangePassword}
            />
          ))}
        </div>
      )}

      {/* Create Email Dialog */}
      <CreateEmailDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />

      {/* Edit Email Dialog */}
      {isEditDialogOpen && selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">
                Modifica Account Email
              </h2>
              <button
                onClick={() => setIsEditDialogOpen(false)}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateEmail} className="p-6 space-y-4">
              <div>
                <Label htmlFor="edit-quota">Quota Archiviazione (MB)</Label>
                <Input
                  id="edit-quota"
                  type="number"
                  value={editFormData.quota}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, quota: e.target.value }))
                  }
                  min="100"
                />
              </div>

              <div>
                <Label htmlFor="edit-forwardTo">Inoltra A</Label>
                <Input
                  id="edit-forwardTo"
                  type="email"
                  value={editFormData.forwardTo}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, forwardTo: e.target.value }))
                  }
                  placeholder="forward@example.com"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-autoReply"
                  checked={editFormData.autoReply}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, autoReply: e.target.checked }))
                  }
                />
                <Label htmlFor="edit-autoReply">Abilita Risposta Automatica</Label>
              </div>

              {editFormData.autoReply && (
                <div>
                  <Label htmlFor="edit-autoReplyMsg">Messaggio Risposta Automatica</Label>
                  <textarea
                    id="edit-autoReplyMsg"
                    value={editFormData.autoReplyMsg}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        autoReplyMsg: e.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-md"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-isActive"
                  checked={editFormData.isActive}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                />
                <Label htmlFor="edit-isActive">Account Attivo</Label>
              </div>

              <div>
                <Label htmlFor="edit-clientName">Nome Cliente</Label>
                <Input
                  id="edit-clientName"
                  value={editFormData.clientName}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, clientName: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="edit-notes">Note</Label>
                <textarea
                  id="edit-notes"
                  value={editFormData.notes}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-border rounded-md"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button type="submit" className="flex-1">
                  Salva Modifiche
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Dialog */}
      {isPasswordDialogOpen && selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">
                Cambia Password
              </h2>
              <button
                onClick={() => setIsPasswordDialogOpen(false)}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Modifica password per: <strong>{selectedEmail.email}</strong>
              </p>

              {passwordError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded">
                  {passwordError}
                </div>
              )}

              <div>
                <Label htmlFor="newPassword">Nuova Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  placeholder="Min. 8 caratteri"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Conferma Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  placeholder="Reinserisci password"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsPasswordDialogOpen(false)}
                  className="flex-1"
                >
                  Annulla
                </Button>
                <Button type="submit" className="flex-1">
                  Cambia Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
