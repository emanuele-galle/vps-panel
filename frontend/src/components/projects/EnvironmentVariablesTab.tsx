'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Save, RefreshCw, Eye, EyeOff, Copy, Check, AlertTriangle, Variable } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
} from '@/components/ui/alert-dialog';

interface EnvVariable {
  key: string;
  value: string;
}

interface EnvironmentVariablesTabProps {
  projectId: string;
}

export function EnvironmentVariablesTab({ projectId }: EnvironmentVariablesTabProps) {
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [originalVariables, setOriginalVariables] = useState<EnvVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  // Fetch environment variables
  const fetchEnvVars = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/env`, {
        credentials: 'include', // Send HttpOnly cookies
      });
      if (res.ok) {
        const data = await res.json();
        const vars = data.data?.variables || [];
        setVariables(vars);
        setOriginalVariables(JSON.parse(JSON.stringify(vars)));
        setHasChanges(false);
      } else {
        const error = await res.json();
        toast.error('Errore nel caricamento', {
          description: error.error?.message || 'Impossibile caricare le variabili ambiente',
        });
      }
    } catch (error) {
      console.error('Failed to fetch env vars:', error);
      toast.error('Errore di connessione');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEnvVars();
  }, [fetchEnvVars]);

  // Check for changes
  useEffect(() => {
    const changed = JSON.stringify(variables) !== JSON.stringify(originalVariables);
    setHasChanges(changed);
  }, [variables, originalVariables]);

  // Update variable
  const updateVariable = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: value };
    setVariables(updated);
  };

  // Delete variable
  const deleteVariable = (index: number) => {
    const updated = variables.filter((_, i) => i !== index);
    setVariables(updated);
  };

  // Add new variable
  const addVariable = () => {
    if (!newKey.trim()) {
      toast.error('Chiave richiesta', { description: 'Inserisci un nome per la variabile' });
      return;
    }

    // Check for duplicates
    if (variables.some((v) => v.key === newKey.trim())) {
      toast.error('Chiave duplicata', { description: 'Esiste già una variabile con questo nome' });
      return;
    }

    setVariables([...variables, { key: newKey.trim(), value: newValue }]);
    setNewKey('');
    setNewValue('');
    toast.success('Variabile aggiunta', { description: 'Ricorda di salvare le modifiche' });
  };

  // Save changes
  const saveChanges = async () => {
    // Validate keys
    const invalidKeys = variables.filter((v) => !v.key.match(/^[A-Z_][A-Z0-9_]*$/i));
    if (invalidKeys.length > 0) {
      toast.error('Chiavi non valide', {
        description: 'Le chiavi devono contenere solo lettere, numeri e underscore',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/env`, {
        method: 'PUT',
        credentials: 'include', // Send HttpOnly cookies
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ variables }),
      });

      if (res.ok) {
        const data = await res.json();
        setOriginalVariables(JSON.parse(JSON.stringify(variables)));
        setHasChanges(false);
        toast.success('Variabili salvate', {
          description: 'Le modifiche sono state applicate al file .env',
        });
      } else {
        const error = await res.json();
        toast.error('Errore nel salvataggio', {
          description: error.error?.message || 'Impossibile salvare le variabili',
        });
      }
    } catch (error) {
      console.error('Failed to save env vars:', error);
      toast.error('Errore di connessione');
    } finally {
      setSaving(false);
    }
  };

  // Copy value
  const copyValue = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Discard changes
  const discardChanges = () => {
    setVariables(JSON.parse(JSON.stringify(originalVariables)));
    setHasChanges(false);
    toast.info('Modifiche annullate');
  };

  // Sensitive keys pattern
  const isSensitiveKey = (key: string) => {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /api/i,
      /auth/i,
      /credential/i,
      /private/i,
    ];
    return sensitivePatterns.some((pattern) => pattern.test(key));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Caricamento variabili...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Variable className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Variabili Ambiente
              </h3>
              <p className="text-sm text-muted-foreground">
                Gestisci le variabili del file .env del progetto
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowValues(!showValues)}
              className="text-muted-foreground"
            >
              {showValues ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {showValues ? 'Nascondi' : 'Mostra'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchEnvVars}
              disabled={loading}
              className="text-muted-foreground"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Warning Banner */}
        {hasChanges && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Hai modifiche non salvate</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={discardChanges}>
                Annulla
              </Button>
              <Button size="sm" onClick={saveChanges} disabled={saving}>
                {saving ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Salva
              </Button>
            </div>
          </div>
        )}

        {/* Add New Variable */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg border border-border">
          <h4 className="text-sm font-medium text-foreground mb-3">
            Aggiungi Nuova Variabile
          </h4>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="NOME_VARIABILE"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <span className="text-muted-foreground">=</span>
            <input
              type="text"
              placeholder="valore"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <Button onClick={addVariable} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Aggiungi
            </Button>
          </div>
        </div>

        {/* Variables List */}
        {variables.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">
                {variables.length} variabili configurate
              </span>
              <Badge variant="info">.env</Badge>
            </div>
            {variables.map((variable, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-card rounded-lg border border-border hover:border-border dark:hover:border-border transition-colors"
              >
                {/* Key Input */}
                <input
                  type="text"
                  value={variable.key}
                  onChange={(e) => updateVariable(index, 'key', e.target.value.toUpperCase())}
                  className="w-48 px-3 py-2 text-sm border border-border rounded-lg bg-muted/50 text-foreground font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
                <span className="text-muted-foreground">=</span>
                {/* Value Input */}
                <div className="flex-1 relative">
                  <input
                    type={showValues || !isSensitiveKey(variable.key) ? 'text' : 'password'}
                    value={variable.value}
                    onChange={(e) => updateVariable(index, 'value', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-muted/50 text-foreground focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 pr-10"
                  />
                  {isSensitiveKey(variable.key) && (
                    <Badge
                      variant="warning"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1"
                    >
                      Sensibile
                    </Badge>
                  )}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => copyValue(variable.key, variable.value)}
                    className="p-2 hover:bg-muted hover:bg-accent rounded-lg transition-colors"
                    title="Copia valore"
                  >
                    {copiedKey === variable.key ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="p-2 hover:bg-destructive/20 hover:bg-destructive/20 rounded-lg transition-colors text-destructive"
                        title="Elimina"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Elimina variabile</AlertDialogTitle>
                        <AlertDialogDescription>
                          Sei sicuro di voler eliminare la variabile <code className="font-mono bg-muted px-1 rounded">{variable.key}</code>?
                          <br />
                          Ricorda di salvare le modifiche dopo l'eliminazione.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteVariable(index)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Elimina
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Variable className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">Nessuna variabile ambiente trovata</p>
            <p className="text-sm mt-2">
              Il file .env non esiste o è vuoto. Aggiungi la prima variabile sopra.
            </p>
          </div>
        )}

        {/* Save Button (Fixed at bottom when has changes) */}
        {hasChanges && variables.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border flex justify-end gap-3">
            <Button variant="outline" onClick={discardChanges}>
              Annulla Modifiche
            </Button>
            <Button onClick={saveChanges} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salva Modifiche
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
