'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDomainsStore } from '@/store/domainsStore';
import { useProjectsStore } from '@/store/projectsStore';

interface AddDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedProjectId?: string;
}

export function AddDomainModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedProjectId,
}: AddDomainModalProps) {
  const { createDomain, verifyDomain, isLoading, error } = useDomainsStore();
  const { projects, fetchProjects } = useProjectsStore();

  const [formData, setFormData] = useState({
    domain: '',
    projectId: preselectedProjectId || '',
    sslEnabled: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [verification, setVerification] = useState<{
    isValid: boolean;
    message: string;
    checked: boolean;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (isOpen && projects.length === 0) {
      fetchProjects();
    }
  }, [isOpen, projects.length, fetchProjects]);

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        domain: '',
        projectId: preselectedProjectId || '',
        sslEnabled: true,
      });
      setErrors({});
      setVerification(null);
    }
  }, [isOpen, preselectedProjectId]);

  const validateDomain = (domain: string): boolean => {
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    return domainRegex.test(domain);
  };

  const handleVerify = async () => {
    if (!formData.domain) {
      setErrors({ domain: 'Il dominio è obbligatorio' });
      return;
    }

    if (!validateDomain(formData.domain)) {
      setErrors({ domain: 'Formato dominio non valido' });
      return;
    }

    setIsVerifying(true);
    setErrors({});

    try {
      const result = await verifyDomain(formData.domain);
      setVerification({
        isValid: result.isValid,
        message: result.message,
        checked: true,
      });
    } catch (error: any) {
      setVerification({
        isValid: false,
        message: error.message || 'Verifica fallita',
        checked: true,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.domain.trim()) {
      newErrors.domain = 'Il dominio è obbligatorio';
    } else if (!validateDomain(formData.domain)) {
      newErrors.domain = 'Formato dominio non valido (es. esempio.com)';
    }

    if (!formData.projectId) {
      newErrors.projectId = 'Seleziona un progetto';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await createDomain({
        domain: formData.domain,
        projectId: formData.projectId,
        sslEnabled: formData.sslEnabled,
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to create domain:', error);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Reset verification when domain changes
    if (name === 'domain') {
      setVerification(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-semibold text-foreground">
            Aggiungi Dominio Personalizzato
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Domain Input */}
          <div className="space-y-2">
            <Label htmlFor="domain">
              Dominio <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="domain"
                name="domain"
                value={formData.domain}
                onChange={handleChange}
                placeholder="esempio.com"
                className={errors.domain ? 'border-destructive' : ''}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleVerify}
                disabled={isVerifying || !formData.domain}
              >
                {isVerifying ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  'Verifica'
                )}
              </Button>
            </div>
            {errors.domain && (
              <p className="text-sm text-destructive">
                {errors.domain}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Inserisci il tuo dominio personalizzato (es. esempio.com o sottodominio.esempio.com)
            </p>
          </div>

          {/* Verification Result */}
          {verification?.checked && (
            <div
              className={`p-3 rounded-lg border ${
                verification.isValid
                  ? 'bg-success/10 border-success/30'
                  : 'bg-warning/10 border-warning/30'
              }`}
            >
              <div className="flex items-center gap-2">
                {verification.isValid ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-warning" />
                )}
                <p
                  className={`text-sm ${
                    verification.isValid
                      ? 'text-success'
                      : 'text-warning'
                  }`}
                >
                  {verification.message}
                </p>
              </div>
              {!verification.isValid && (
                <p className="text-xs text-warning mt-2">
                  Assicurati che il record DNS A del tuo dominio punti all'indirizzo IP
                  del tuo server.
                </p>
              )}
            </div>
          )}

          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="projectId">
              Progetto <span className="text-destructive">*</span>
            </Label>
            <select
              id="projectId"
              name="projectId"
              value={formData.projectId}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.projectId
                  ? 'border-destructive'
                  : 'border-border'
              }`}
            >
              <option value="">Seleziona un progetto</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.slug})
                </option>
              ))}
            </select>
            {errors.projectId && (
              <p className="text-sm text-destructive">
                {errors.projectId}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Seleziona a quale progetto deve puntare questo dominio
            </p>
          </div>

          {/* SSL Toggle */}
          <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
            <input
              type="checkbox"
              id="sslEnabled"
              name="sslEnabled"
              checked={formData.sslEnabled}
              onChange={handleChange}
              className="rounded border-border"
            />
            <div>
              <Label htmlFor="sslEnabled" className="cursor-pointer font-medium">
                Abilita SSL (Consigliato)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Provisiona automaticamente il certificato SSL tramite Let's Encrypt
              </p>
            </div>
          </div>

          {/* DNS Instructions */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-primary mb-2">
              Configurazione DNS Richiesta
            </h4>
            <p className="text-xs text-primary">
              Prima di aggiungere questo dominio, assicurati di configurare il tuo provider DNS
              per puntare il dominio all'indirizzo IP del tuo server:
            </p>
            <div className="mt-2 p-2 bg-primary/15 rounded font-mono text-xs text-primary">
              Record A: {formData.domain || 'tuo-dominio.com'} → IP del Server
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Aggiunta in corso...' : 'Aggiungi Dominio'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
