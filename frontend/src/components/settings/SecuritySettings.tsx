'use client';

import { useState } from 'react';
import { Key, Save } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { TwoFactorSetup } from './TwoFactorSetup';
import { SessionManagement } from './SessionManagement';
import api from '@/lib/api';

export function SecuritySettings() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    setSuccess(null);
  };

  const validatePasswordForm = () => {
    const newErrors: Record<string, string> = {};

    if (!passwordData.currentPassword) {
      newErrors.currentPassword = 'La password attuale è obbligatoria';
    }

    if (!passwordData.newPassword) {
      newErrors.newPassword = 'La nuova password è obbligatoria';
    } else if (passwordData.newPassword.length < 8) {
      newErrors.newPassword = 'La password deve contenere almeno 8 caratteri';
    }

    if (!passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Conferma la tua password';
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      newErrors.confirmPassword = 'Le password non corrispondono';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePasswordForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await api.put('/auth/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setSuccess('Password aggiornata con successo! Verrai disconnesso per sicurezza.');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      // Password update invalidates all sessions, so user will be logged out
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Errore durante l\'aggiornamento della password';
      setErrors({ submit: message });
    } finally {
      setIsLoading(false);
    }
  };

  const { fetchUser } = useAuthStore();

  const handle2FAStatusChange = async () => {
    // Refresh user data to get updated 2FA status
    await fetchUser();
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Cambia Password
              </h3>
              <p className="text-sm text-muted-foreground">
                Aggiorna la tua password per mantenere il tuo account sicuro
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            {/* Success Message */}
            {success && (
              <div className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded">
                {success}
              </div>
            )}

            {/* Error Message */}
            {errors.submit && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded">
                {errors.submit}
              </div>
            )}

            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Password Attuale</Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                className={errors.currentPassword ? 'border-destructive' : ''}
              />
              {errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {errors.currentPassword}
                </p>
              )}
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nuova Password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                className={errors.newPassword ? 'border-destructive' : ''}
              />
              {errors.newPassword && (
                <p className="text-sm text-destructive">
                  {errors.newPassword}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Deve contenere almeno 8 caratteri
              </p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Conferma Nuova Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                className={errors.confirmPassword ? 'border-destructive' : ''}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? 'Aggiornamento...' : 'Aggiorna Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardContent className="pt-6">
          <TwoFactorSetup
            isEnabled={user?.twoFactorEnabled ?? false}
            onStatusChange={handle2FAStatusChange}
          />
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card>
        <CardContent className="pt-6">
          <SessionManagement lastLoginAt={user?.lastLoginAt} />
        </CardContent>
      </Card>
    </div>
  );
}
