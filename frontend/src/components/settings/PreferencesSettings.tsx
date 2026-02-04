'use client';

import { useState, useEffect } from 'react';
import { Palette, Bell, Globe, Save } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { preferencesApi } from '@/lib/api';

export function PreferencesSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [preferences, setPreferences] = useState({
    theme: 'system',
    language: 'it',
    notifications: {
      email: true,
      push: false,
      systemAlerts: true,
      projectUpdates: true,
    },
    dashboard: {
      autoRefresh: true,
      refreshInterval: 30,
      compactView: false,
    },
  });

  // Load preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const response = await preferencesApi.get();
        if (response.data.success) {
          setPreferences(response.data.data);
        }
      } catch (err: any) {
        console.error("Errore caricamento preferenze:", err);
      } finally {
        setIsFetching(false);
      }
    }
    loadPreferences();
  }, []);

  const handleThemeChange = (theme: string) => {
    setPreferences((prev) => ({ ...prev, theme }));
    setSuccess(false);
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }));
    setSuccess(false);
  };

  const handleDashboardChange = (key: string, value: any) => {
    setPreferences((prev) => ({
      ...prev,
      dashboard: { ...prev.dashboard, [key]: value },
    }));
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await preferencesApi.update(preferences);
      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Errore nel salvataggio delle preferenze");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success Message */}
      {success && (
        <div className="bg-success/10 border border-success/30 text-success px-4 py-3 rounded">
          Preferenze salvate con successo!
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Palette className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Aspetto
              </h3>
              <p className="text-sm text-muted-foreground">
                Personalizza l'aspetto dell'applicazione
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Theme */}
          <div className="space-y-3">
            <Label>Tema</Label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'light', label: 'Chiaro' },
                { value: 'dark', label: 'Scuro' },
                { value: 'system', label: 'Sistema' }
              ].map((theme) => (
                <button
                  key={theme.value}
                  type="button"
                  onClick={() => handleThemeChange(theme.value)}
                  className={`p-4 border-2 rounded-lg transition-all ${
                    preferences.theme === theme.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-border dark:hover:border-border'
                  }`}
                >
                  <div className="text-center">
                    <p className="font-medium text-foreground">
                      {theme.label}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <Label htmlFor="language">Lingua</Label>
            <select
              id="language"
              value={preferences.language}
              onChange={(e) =>
                setPreferences((prev) => ({ ...prev, language: e.target.value }))
              }
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground"
            >
              <option value="en">English</option>
              <option value="it">Italiano</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Notifiche
              </h3>
              <p className="text-sm text-muted-foreground">
                Gestisci come ricevi le notifiche
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Email Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Notifiche Email
              </p>
              <p className="text-sm text-muted-foreground">
                Ricevi notifiche via email
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.notifications.email}
              onChange={(e) =>
                handleNotificationChange('email', e.target.checked)
              }
              className="rounded border-border"
            />
          </div>

          {/* Push Notifications */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Notifiche Push
              </p>
              <p className="text-sm text-muted-foreground">
                Ricevi notifiche push nel browser
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.notifications.push}
              onChange={(e) => handleNotificationChange('push', e.target.checked)}
              className="rounded border-border"
            />
          </div>

          {/* System Alerts */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Avvisi di Sistema
              </p>
              <p className="text-sm text-muted-foreground">
                Notifiche di sistema critiche
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.notifications.systemAlerts}
              onChange={(e) =>
                handleNotificationChange('systemAlerts', e.target.checked)
              }
              className="rounded border-border"
            />
          </div>

          {/* Project Updates */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Aggiornamenti Progetti
              </p>
              <p className="text-sm text-muted-foreground">
                Aggiornamenti sui tuoi progetti
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.notifications.projectUpdates}
              onChange={(e) =>
                handleNotificationChange('projectUpdates', e.target.checked)
              }
              className="rounded border-border"
            />
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Dashboard
              </h3>
              <p className="text-sm text-muted-foreground">
                Personalizza la tua esperienza dashboard
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Auto-refresh */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Aggiornamento Automatico Metriche
              </p>
              <p className="text-sm text-muted-foreground">
                Aggiorna automaticamente le metriche di sistema
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.dashboard.autoRefresh}
              onChange={(e) =>
                handleDashboardChange('autoRefresh', e.target.checked)
              }
              className="rounded border-border"
            />
          </div>

          {/* Refresh Interval */}
          {preferences.dashboard.autoRefresh && (
            <div className="space-y-2">
              <Label htmlFor="refreshInterval">
                Intervallo Aggiornamento (secondi)
              </Label>
              <select
                id="refreshInterval"
                value={preferences.dashboard.refreshInterval}
                onChange={(e) =>
                  handleDashboardChange('refreshInterval', Number(e.target.value))
                }
                className="w-full px-3 py-2 border border-border rounded-md bg-card"
              >
                <option value="5">5 secondi</option>
                <option value="10">10 secondi</option>
                <option value="30">30 secondi</option>
                <option value="60">60 secondi</option>
              </select>
            </div>
          )}

          {/* Compact View */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground">
                Vista Compatta
              </p>
              <p className="text-sm text-muted-foreground">
                Usa un layout più condensato
              </p>
            </div>
            <input
              type="checkbox"
              checked={preferences.dashboard.compactView}
              onChange={(e) =>
                handleDashboardChange('compactView', e.target.checked)
              }
              className="rounded border-border"
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          <Save className="h-4 w-4 mr-2" />
          {isLoading ? 'Salvataggio...' : 'Salva Preferenze'}
        </Button>
      </div>
    </form>
  );
}
