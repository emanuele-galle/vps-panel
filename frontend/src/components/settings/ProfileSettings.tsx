'use client';

import { useState } from 'react';
import { User, Mail, Save } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';

export function ProfileSettings() {
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    setSuccess(false);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Il nome è obbligatorio';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email è obbligatoria';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Indirizzo email non valido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await authApi.updateProfile({
        name: formData.name,
        email: formData.email,
      });
      if (response.data.data?.user) {
        useAuthStore.getState().setUser(response.data.data.user);
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      setErrors({ submit: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Informazioni Profilo
            </h3>
            <p className="text-sm text-muted-foreground">
              Aggiorna le informazioni del tuo profilo
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Success Message */}
          {success && (
            <div className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded">
              Profilo aggiornato con successo!
            </div>
          )}

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded">
              {errors.submit}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome Completo</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Mario Rossi"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Indirizzo Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="mario@esempio.it"
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email}
              </p>
            )}
          </div>

          {/* Role (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="role">Ruolo</Label>
            <Input
              id="role"
              value={user?.role || 'STAFF'}
              readOnly
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Contatta un amministratore per cambiare il tuo ruolo
            </p>
          </div>

          {/* Account Status */}
          <div className="space-y-2">
            <Label>Stato Account</Label>
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  user?.isActive
                    ? 'bg-success'
                    : 'bg-destructive'
                }`}
              />
              <span className="text-sm text-foreground">
                {user?.isActive ? 'Attivo' : 'Inattivo'}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Salvataggio...' : 'Salva Modifiche'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
