'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectsStore } from '@/store/projectsStore';
import { Project, ProjectStatus } from '@/types';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface EditProjectModalProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onSave?: (project: Project) => void;
}

export function EditProjectModal({
  project,
  open,
  onClose,
  onSave,
}: EditProjectModalProps) {
  const { updateProject, isLoading } = useProjectsStore();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientName: '',
    clientEmail: '',
    status: 'ACTIVE' as ProjectStatus,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when project changes
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        description: project.description || '',
        clientName: project.clientName || '',
        clientEmail: project.clientEmail || '',
        status: project.status || 'ACTIVE',
      });
      setErrors({});
    }
  }, [project]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Il nome del progetto è obbligatorio';
    }

    if (formData.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail)) {
      newErrors.clientEmail = 'Email non valida';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !project) {
      return;
    }

    setIsSaving(true);

    try {
      await updateProject(project.id, {
        name: formData.name,
        description: formData.description || undefined,
        clientName: formData.clientName || undefined,
        clientEmail: formData.clientEmail || undefined,
        status: formData.status,
      });

      toast.success('Progetto aggiornato con successo');
      onSave?.({ ...project, ...formData });
      onClose();
    } catch (error) {
      toast.error('Errore durante il salvataggio del progetto');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifica Progetto</DialogTitle>
          <DialogDescription>
            Modifica le informazioni del progetto. I campi con * sono obbligatori.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome Progetto <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Nome del progetto"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Descrizione del progetto"
              rows={3}
            />
          </div>

          {/* Client Name */}
          <div className="space-y-2">
            <Label htmlFor="clientName">Nome Cliente</Label>
            <Input
              id="clientName"
              value={formData.clientName}
              onChange={(e) => handleChange('clientName', e.target.value)}
              placeholder="Nome del cliente"
            />
          </div>

          {/* Client Email */}
          <div className="space-y-2">
            <Label htmlFor="clientEmail">Email Cliente</Label>
            <Input
              id="clientEmail"
              type="email"
              value={formData.clientEmail}
              onChange={(e) => handleChange('clientEmail', e.target.value)}
              placeholder="email@esempio.com"
              className={errors.clientEmail ? 'border-destructive' : ''}
            />
            {errors.clientEmail && (
              <p className="text-sm text-destructive">{errors.clientEmail}</p>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Stato</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => handleChange('status', value as ProjectStatus)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-success rounded-full" />
                    Attivo
                  </span>
                </SelectItem>
                <SelectItem value="INACTIVE">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-muted/500 rounded-full" />
                    Inattivo
                  </span>
                </SelectItem>
                <SelectItem value="MAINTENANCE">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-warning/100 rounded-full" />
                    Manutenzione
                  </span>
                </SelectItem>
                <SelectItem value="ERROR">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-destructive rounded-full" />
                    Errore
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Read-only info */}
          <div className="pt-4 border-t space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Slug:</span>
              <span className="font-mono">{project.slug}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Template:</span>
              <span>{project.template}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Path:</span>
              <span className="font-mono text-xs truncate max-w-[250px]">
                {project.path}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              Annulla
            </Button>
            <Button type="submit" disabled={isSaving || isLoading}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salva Modifiche
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default EditProjectModal;
