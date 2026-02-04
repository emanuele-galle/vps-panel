'use client';

import { useEffect, useState } from 'react';
import {
  User,
  Shield,
  Settings,
  Palette,
  Zap,
  RefreshCw,
  AlertCircle,
  Save,
  Download,
  CheckCircle,
  Eye,
  EyeOff,
  Search,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  X,
  Archive,
  Cloud,
  Info,
  Wrench,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { PreferencesSettings } from '@/components/settings/PreferencesSettings';
import { OptimizationSettings } from '@/components/settings/OptimizationSettings';
import { useSystemSettingsStore } from '@/store/systemSettingsStore';
import { useAuthStore } from '@/store/authStore';
import { SystemBackupSettings } from '@/components/settings/SystemBackupSettings';
import { GDriveBackupSection } from '@/components/settings/GDriveBackupSection';
import { AboutSection } from '@/components/settings/AboutSection';
import { MaintenanceSettings } from '@/components/settings/MaintenanceSettings';

type UserTab = 'profile' | 'security' | 'preferences' | 'optimization';
type AdminTab = 'sistema' | 'backup' | 'gdrive' | 'manutenzione' | 'about';
type Tab = UserTab | AdminTab;

export default function SettingsPage() {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // System settings state (for admin tabs)
  const {
    groupedSettings,
    isLoading,
    error,
    fetchGroupedSettings,
    bulkUpdateSettings,
    initializeDefaults,
  } = useSystemSettingsStore();

  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Load system settings when admin accesses sistema tab
  useEffect(() => {
    if (isAdmin && activeTab === 'sistema') {
      fetchGroupedSettings();
    }
  }, [isAdmin, activeTab]);

  const userTabs = [
    {
      id: 'profile' as Tab,
      label: 'Profilo',
      icon: User,
      description: 'Gestisci le informazioni del tuo account',
    },
    {
      id: 'security' as Tab,
      label: 'Sicurezza',
      icon: Shield,
      description: 'Impostazioni password e autenticazione',
    },
    {
      id: 'preferences' as Tab,
      label: 'Preferenze',
      icon: Palette,
      description: 'Personalizza la tua esperienza',
    },
    {
      id: 'optimization' as Tab,
      label: 'Ottimizzazione',
      icon: Zap,
      description: 'Gestisci lo spazio su disco e ottimizza le prestazioni del sistema',
    },
    {
      id: 'about' as Tab,
      label: 'About',
      icon: Info,
      description: 'Informazioni sulla console, versione e changelog',
    },
  ];

  const adminTabs = [
    {
      id: 'sistema' as Tab,
      label: 'Sistema',
      icon: Wrench,
      description: 'Configura le impostazioni globali del sistema',
    },
    {
      id: 'backup' as Tab,
      label: 'Backup',
      icon: Archive,
      description: 'Gestisci i backup di sistema',
    },
    {
      id: 'gdrive' as Tab,
      label: 'Google Drive',
      icon: Cloud,
      description: 'Configura integrazione Google Drive per backup',
    },
    {
      id: 'manutenzione' as Tab,
      label: 'Manutenzione',
      icon: Calendar,
      description: 'Configura la manutenzione automatica programmata del sistema',
    },
  ];

  const allTabs = isAdmin ? [...userTabs, ...adminTabs] : userTabs;
  const currentTabInfo = allTabs.find((t) => t.id === activeTab);

  // System settings handlers
  const handleValueChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSecretVisibility = (key: string) => {
    setVisibleSecrets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const resetField = (key: string) => {
    setEditedValues((prev) => {
      const newValues = { ...prev };
      delete newValues[key];
      return newValues;
    });
  };

  const formatLabel = (key: string): string => {
    const parts = key.split('.');
    const lastPart = parts[parts.length - 1];
    return lastPart
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const handleSave = async () => {
    if (Object.keys(editedValues).length === 0) {
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const settingsToUpdate = Object.entries(editedValues).map(([key, value]) => ({
        key,
        value,
      }));

      await bulkUpdateSettings(settingsToUpdate);
      setEditedValues({});
      setSaveSuccess(true);

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleInitialize = async () => {
    if (
      !confirm(
        'Inizializzare le impostazioni predefinite? Questo non sovrascrivera i valori esistenti.'
      )
    ) {
      return;
    }

    try {
      await initializeDefaults();
    } catch (error: any) {
      console.error('Errore durante inizializzazione impostazioni predefinite:', error);
    }
  };

  const hasUnsavedChanges = Object.keys(editedValues).length > 0;

  const categoryLabels: Record<string, string> = {
    traefik: 'Configurazione Traefik',
    api_keys: 'Chiavi API',
    limits: 'Limiti Risorse Predefiniti',
    smtp: 'Impostazioni SMTP',
    backup: 'Impostazioni Backup',
    system: 'Impostazioni Sistema',
    general: 'Impostazioni Generali',
  };

  const categoryDescriptions: Record<string, string> = {
    traefik: 'Configura reverse proxy Traefik e impostazioni certificati SSL',
    api_keys: 'Gestisci chiavi API per servizi esterni (Hostinger, Cloudflare, ecc.)',
    limits: 'Imposta limiti risorse predefiniti per nuovi container e progetti',
    smtp: 'Configura server SMTP per invio notifiche email',
    backup: 'Configura impostazioni backup automatici e politiche di conservazione',
    system: 'Impostazioni generali di sistema e opzioni di manutenzione',
    general: 'Altre impostazioni generali del sistema',
  };

  // Filter settings based on search query
  const filteredGroupedSettings = groupedSettings
    ? Object.entries(groupedSettings).reduce(
        (acc, [category, settings]) => {
          const filteredSettings = settings.filter((setting) => {
            const searchLower = searchQuery.toLowerCase();
            return (
              setting.key.toLowerCase().includes(searchLower) ||
              setting.description?.toLowerCase().includes(searchLower) ||
              categoryLabels[category]?.toLowerCase().includes(searchLower)
            );
          });

          if (filteredSettings.length > 0) {
            acc[category] = filteredSettings;
          }

          return acc;
        },
        {} as typeof groupedSettings
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Impostazioni
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin
              ? 'Gestisci account, preferenze e configurazioni di sistema'
              : 'Gestisci le impostazioni del tuo account e le preferenze'}
          </p>
        </div>

        {/* Admin actions for Sistema tab */}
        {activeTab === 'sistema' && isAdmin && (
          <div className="flex gap-2">
            <Button onClick={handleInitialize} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Inizializza Predefinite
            </Button>
            <Button
              onClick={() => fetchGroupedSettings()}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Aggiorna
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || saving}
              variant={hasUnsavedChanges ? 'default' : 'outline'}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Salvato
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
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {/* User Tabs */}
          {userTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group inline-flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground hover:border-border dark:hover:border-border'
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground group-hover:text-muted-foreground'
                  }`}
                />
                {tab.label}
              </button>
            );
          })}

          {/* Separator for Admin Tabs */}
          {isAdmin && (
            <div className="flex items-center px-2">
              <div className="h-6 w-px bg-border dark:bg-muted" />
            </div>
          )}

          {/* Admin Tabs */}
          {isAdmin && adminTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group inline-flex items-center gap-2 px-1 py-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground hover:border-border dark:hover:border-border'
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground group-hover:text-muted-foreground'
                  }`}
                />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Description */}
      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
        <p className="text-sm text-primary">
          {currentTabInfo?.description}
        </p>
      </div>

      {/* Tab Content */}
      <div className="pb-8">
        {/* User Tabs Content */}
        {activeTab === 'profile' && <ProfileSettings />}
        {activeTab === 'security' && <SecuritySettings />}
        {activeTab === 'preferences' && <PreferencesSettings />}
        {activeTab === 'optimization' && <OptimizationSettings />}

        {/* Admin Tabs Content */}
        {activeTab === 'sistema' && isAdmin && (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Cerca impostazioni..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Unsaved changes warning */}
            {hasUnsavedChanges && (
              <div className="bg-warning/10 border border-warning/30 text-warning px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                <p>Hai modifiche non salvate. Clicca "Salva Modifiche" per applicarle.</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            )}

            {/* Loading State */}
            {isLoading && !groupedSettings ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 text-primary animate-spin mx-auto" />
                  <p className="text-muted-foreground mt-2">Caricamento impostazioni...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Settings by Category */}
                {filteredGroupedSettings &&
                  Object.entries(filteredGroupedSettings).map(([category, settings]) => {
                    const isCollapsed = collapsedCategories.has(category);

                    return (
                      <div
                        key={category}
                        className="bg-card border border-border rounded-lg overflow-hidden"
                      >
                        <div
                          className="p-6 cursor-pointer hover:bg-accent dark:hover:bg-accent transition-colors"
                          onClick={() => toggleCategoryCollapse(category)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {isCollapsed ? (
                                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                )}
                                <h2 className="text-xl font-semibold text-foreground">
                                  {categoryLabels[category] || category}
                                </h2>
                                <span className="text-sm text-muted-foreground">
                                  ({settings.length})
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 ml-7">
                                {categoryDescriptions[category] || ''}
                              </p>
                            </div>
                          </div>
                        </div>

                        {!isCollapsed && (
                          <div className="px-6 pb-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {settings.map((setting) => {
                                const currentValue =
                                  editedValues[setting.key] !== undefined
                                    ? editedValues[setting.key]
                                    : setting.value;

                                const isSecret = setting.isSecret;
                                const showSecret = visibleSecrets.has(setting.key);
                                const displayValue =
                                  isSecret && !showSecret && currentValue === '********'
                                    ? '********'
                                    : currentValue;

                                const isModified = editedValues[setting.key] !== undefined;

                                return (
                                  <div key={setting.key} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label htmlFor={setting.key} className="flex items-center gap-2">
                                        {formatLabel(setting.key)}
                                        {isSecret && (
                                          <span className="text-xs px-2 py-0.5 bg-warning/15 text-warning rounded">
                                            Segreto
                                          </span>
                                        )}
                                        {isModified && (
                                          <span className="text-xs px-2 py-0.5 bg-primary/15 text-primary rounded">
                                            Modificato
                                          </span>
                                        )}
                                      </Label>
                                      {isModified && (
                                        <button
                                          type="button"
                                          onClick={() => resetField(setting.key)}
                                          className="text-xs text-muted-foreground hover:text-foreground dark:hover:text-muted-foreground flex items-center gap-1"
                                          title="Ripristina valore originale"
                                        >
                                          <RotateCcw className="h-3 w-3" />
                                          Ripristina
                                        </button>
                                      )}
                                    </div>

                                    <div className="relative">
                                      <Input
                                        id={setting.key}
                                        type={isSecret && !showSecret ? 'password' : 'text'}
                                        value={displayValue}
                                        onChange={(e) => handleValueChange(setting.key, e.target.value)}
                                        placeholder={setting.description || ''}
                                        className={`pr-10 ${isModified ? 'border-primary border-primary' : ''}`}
                                      />

                                      {isSecret && (
                                        <button
                                          type="button"
                                          onClick={() => toggleSecretVisibility(setting.key)}
                                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
                                        >
                                          {showSecret ? (
                                            <EyeOff className="h-4 w-4" />
                                          ) : (
                                            <Eye className="h-4 w-4" />
                                          )}
                                        </button>
                                      )}
                                    </div>

                                    {setting.description && (
                                      <p className="text-xs text-muted-foreground">
                                        {setting.description}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* Empty State */}
                {groupedSettings && Object.keys(groupedSettings).length === 0 && (
                  <div className="bg-card border border-border rounded-lg p-12 text-center">
                    <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      Nessuna Impostazione Trovata
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Inizializza le impostazioni predefinite per iniziare
                    </p>
                    <Button onClick={handleInitialize}>
                      <Download className="h-4 w-4 mr-2" />
                      Inizializza Impostazioni Predefinite
                    </Button>
                  </div>
                )}

                {/* No search results */}
                {searchQuery &&
                  filteredGroupedSettings &&
                  Object.keys(filteredGroupedSettings).length === 0 && (
                    <div className="bg-card border border-border rounded-lg p-12 text-center">
                      <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        Nessun Risultato
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        Nessuna impostazione corrisponde alla ricerca "{searchQuery}"
                      </p>
                      <Button onClick={() => setSearchQuery('')} variant="outline">
                        <X className="h-4 w-4 mr-2" />
                        Cancella Ricerca
                      </Button>
                    </div>
                  )}
              </>
            )}
          </div>
        )}

        {activeTab === 'about' && <AboutSection />}

        {/* Admin-only tabs */}
        {activeTab === 'backup' && isAdmin && <SystemBackupSettings />}
        {activeTab === 'gdrive' && isAdmin && <GDriveBackupSection />}
        {activeTab === 'manutenzione' && isAdmin && <MaintenanceSettings />}
      </div>
    </div>
  );
}
