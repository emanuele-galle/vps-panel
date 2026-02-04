'use client';

import { useState } from 'react';
import {
  User as UserIcon,
  Shield,
  Edit2,
  Trash2,
  Key,
  MoreVertical,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Power,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User } from '@/store/usersStore';

interface UserCardProps {
  user: User;
  currentUserId: string;
  onEdit: (user: User) => void;
  onDelete: (id: string) => void;
  onChangePassword: (user: User) => void;
  onToggleStatus: (id: string) => void;
}

export function UserCard({
  user,
  currentUserId,
  onEdit,
  onDelete,
  onChangePassword,
  onToggleStatus,
}: UserCardProps) {
  const [showActions, setShowActions] = useState(false);
  const isCurrentUser = user.id === currentUserId;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Mai';
    return new Date(dateString).toLocaleString('it-IT');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/15 flex items-center justify-center">
              {user.role === 'ADMIN' ? (
                <Shield className="h-6 w-6 text-primary" />
              ) : (
                <UserIcon className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">
                  {user.name}
                </h3>
                {isCurrentUser && (
                  <Badge variant="info" className="text-xs">
                    Tu
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant={user.isActive ? 'success' : 'default'}
              className="capitalize"
            >
              {user.isActive ? (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Attivo
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Inattivo
                </>
              )}
            </Badge>

            {!isCurrentUser && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowActions(!showActions)}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {showActions && (
                  <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-10">
                    <button
                      onClick={() => {
                        onEdit(user);
                        setShowActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-muted hover:bg-accent flex items-center gap-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      Modifica Utente
                    </button>
                    <button
                      onClick={() => {
                        onChangePassword(user);
                        setShowActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-muted hover:bg-accent flex items-center gap-2"
                    >
                      <Key className="h-4 w-4" />
                      Cambia Password
                    </button>
                    <button
                      onClick={() => {
                        onToggleStatus(user.id);
                        setShowActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-muted hover:bg-accent flex items-center gap-2"
                    >
                      <Power className="h-4 w-4" />
                      {user.isActive ? 'Disattiva' : 'Attiva'}
                    </button>
                    <button
                      onClick={() => {
                        onDelete(user.id);
                        setShowActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Elimina Utente
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Role */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Ruolo</span>
            <Badge variant={user.role === 'ADMIN' ? 'default' : 'info'}>
              {user.role === 'ADMIN' ? (
                <>
                  <Shield className="h-3 w-3 mr-1" />
                  Amministratore
                </>
              ) : (
                <>
                  <UserIcon className="h-3 w-3 mr-1" />
                  Staff
                </>
              )}
            </Badge>
          </div>

          {/* 2FA Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Autenticazione 2FA
            </span>
            {user.twoFactorEnabled ? (
              <div className="flex items-center gap-1 text-success">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-sm font-medium">Abilitata</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground">
                <XCircle className="h-4 w-4" />
                <span className="text-sm">Disabilitata</span>
              </div>
            )}
          </div>

          {/* Last Login */}
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">
              Ultimo Accesso
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatDate(user.lastLoginAt)}
            </p>
          </div>

          {/* Member Since */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Membro Dal
            </p>
            <p className="text-sm font-medium text-foreground">
              {formatDate(user.createdAt)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
