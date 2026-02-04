'use client';

import { useEffect, useState } from 'react';
import {
  Users as UsersIcon,
  Plus,
  RefreshCw,
  AlertCircle,
  Shield,
  User as UserIcon,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCard } from '@/components/users/UserCard';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';
import { useUsersStore, User, UserRole } from '@/store/usersStore';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

export default function UsersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const {
    users,
    stats,
    isLoading,
    error,
    fetchUsers,
    fetchUserStats,
    updateUser,
    deleteUser,
    changeUserPassword,
    toggleUserStatus,
    searchUsers,
  } = useUsersStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    role: 'STAFF' as UserRole,
    isActive: true,
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    // Check if user is admin
    if (currentUser && currentUser.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }

    fetchUsers();
    fetchUserStats();
  }, [currentUser]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchUsers(), fetchUserStats()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchUsers(searchQuery);
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      await updateUser(selectedUser.id, editFormData);
      setIsEditDialogOpen(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo utente? Questa azione non può essere annullata.')) {
      return;
    }

    try {
      await deleteUser(id);
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const handleChangePassword = (user: User) => {
    setSelectedUser(user);
    setPasswordData({ newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setIsPasswordDialogOpen(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (passwordData.newPassword.length < 8) {
      setPasswordError('La password deve contenere almeno 8 caratteri');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Le password non corrispondono');
      return;
    }

    try {
      await changeUserPassword(selectedUser.id, passwordData.newPassword);
      setIsPasswordDialogOpen(false);
      setSelectedUser(null);
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      setPasswordError((error as Error).message);
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      await toggleUserStatus(id);
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  // Redirect if not admin
  if (currentUser && currentUser.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Gestione Utenti
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci utenti di sistema e permessi (Solo Admin)
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`}
            />
            Aggiorna
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crea Utente
          </Button>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <UsersIcon className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.total}
                </p>
                <p className="text-sm text-muted-foreground">Utenti Totali</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.admins}
                </p>
                <p className="text-sm text-muted-foreground">Admins</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <UserIcon className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.staff}
                </p>
                <p className="text-sm text-muted-foreground">Staff</p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-success/15 flex items-center justify-center">
                <span className="text-xl">✓</span>
              </div>
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
              <div className="h-8 w-8 rounded-full bg-destructive/15 flex items-center justify-center">
                <span className="text-xl">✕</span>
              </div>
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
              <ShieldCheck className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.with2FA}
                </p>
                <p className="text-sm text-muted-foreground">Con 2FA</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-card border border-border rounded-lg p-4">
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca utenti per nome o email..."
              className="pl-10"
            />
          </div>
          <Button type="submit">Cerca</Button>
          {searchQuery && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                fetchUsers();
              }}
            >
              Pulisci
            </Button>
          )}
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && users.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 text-primary animate-spin mx-auto" />
            <p className="text-muted-foreground mt-2">Caricamento utenti...</p>
          </div>
        </div>
      ) : users.length === 0 ? (
        /* Empty State */
        <div className="bg-card border border-border rounded-lg p-12">
          <div className="text-center">
            <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Nessun Utente Trovato
            </h3>
            <p className="mt-2 text-muted-foreground">
              {searchQuery
                ? 'Prova a regolare la tua ricerca'
                : 'Inizia creando il tuo primo utente'}
            </p>
            {!searchQuery && (
              <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crea Utente
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Users Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              currentUserId={currentUser?.id || ''}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onChangePassword={handleChangePassword}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Create User Dialog */}
      <CreateUserDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />

      {/* Edit User Dialog */}
      {isEditDialogOpen && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">
                Modifica Utente
              </h2>
              <button
                onClick={() => setIsEditDialogOpen(false)}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
              <div>
                <Label htmlFor="edit-name">Nome Completo</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="edit-email">Indirizzo Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) =>
                    setEditFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="edit-role">Ruolo</Label>
                <select
                  id="edit-role"
                  value={editFormData.role}
                  onChange={(e) =>
                    setEditFormData((prev) => ({
                      ...prev,
                      role: e.target.value as UserRole,
                    }))
                  }
                  className="w-full px-3 py-2 border border-border rounded-md bg-card"
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Amministratore</option>
                </select>
              </div>

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
      {isPasswordDialogOpen && selectedUser && (
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
                Modifica password per: <strong>{selectedUser.name}</strong>
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
