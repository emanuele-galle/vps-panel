'use client';

import { useState } from 'react';
import { Mail, Lock, User, FileText, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEmailStore } from '@/store/emailStore';

interface CreateEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateEmailDialog({ isOpen, onClose }: CreateEmailDialogProps) {
  const { createEmail } = useEmailStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    quota: '1024',
    clientName: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    setError(null);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'L\'indirizzo email è obbligatorio';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Formato email non valido';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'La password è obbligatoria';
    } else if (formData.password.length < 8) {
      newErrors.password = 'La password deve contenere almeno 8 caratteri';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Conferma la password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Le password non corrispondono';
    }

    // Quota validation
    const quotaNum = parseInt(formData.quota);
    if (isNaN(quotaNum) || quotaNum < 100) {
      newErrors.quota = 'La quota deve essere almeno 100 MB';
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
    setError(null);

    try {
      await createEmail({
        email: formData.email,
        password: formData.password,
        quota: parseInt(formData.quota),
        clientName: formData.clientName || undefined,
        notes: formData.notes || undefined,
      });

      // Reset form
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        quota: '1024',
        clientName: '',
        notes: '',
      });

      onClose();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-primary" />
            Crea Account Email
          </DialogTitle>
          <DialogDescription>
            Crea un nuovo account email per i tuoi clienti o progetti
          </DialogDescription>
        </DialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              <Mail className="h-4 w-4 inline mr-2" />
              Indirizzo Email *
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="utente@esempio.com"
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">
              <Lock className="h-4 w-4 inline mr-2" />
              Password *
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Min. 8 caratteri"
              className={errors.password ? 'border-destructive' : ''}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              <Lock className="h-4 w-4 inline mr-2" />
              Conferma Password *
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Reinserisci la password"
              className={errors.confirmPassword ? 'border-destructive' : ''}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Quota */}
          <div className="space-y-2">
            <Label htmlFor="quota">
              <HardDrive className="h-4 w-4 inline mr-2" />
              Quota Spazio (MB) *
            </Label>
            <Input
              id="quota"
              name="quota"
              type="number"
              value={formData.quota}
              onChange={handleChange}
              placeholder="1024"
              min="100"
              className={errors.quota ? 'border-destructive' : ''}
            />
            {errors.quota && (
              <p className="text-sm text-destructive">{errors.quota}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Predefinito: 1024 MB (1 GB)
            </p>
          </div>

          {/* Client Name */}
          <div className="space-y-2">
            <Label htmlFor="clientName">
              <User className="h-4 w-4 inline mr-2" />
              Nome Cliente (Opzionale)
            </Label>
            <Input
              id="clientName"
              name="clientName"
              value={formData.clientName}
              onChange={handleChange}
              placeholder="Mario Rossi"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              <FileText className="h-4 w-4 inline mr-2" />
              Note (Opzionale)
            </Label>
            <textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Note aggiuntive..."
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground"
            />
          </div>

          {/* Info Banner */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
            <p className="text-xs text-primary">
              <strong>Nota:</strong> Se l'API di Hostinger è configurata, l'account email
              verrà creato automaticamente sui server Hostinger. Altrimenti, verrà salvato
              solo localmente.
            </p>
          </div>

          {/* Actions */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creazione...' : 'Crea Account Email'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
