'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Input } from '@/components/ui/input';
import {
  Search,
  FolderGit2,
  Database,
  Globe,
  Container,
  Settings,
  Users,
  Mail,
  HardDrive,
  Activity,
  Shield,
  FileText,
  Home,
  Command,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  href: string;
  keywords: string[];
  category: string;
}

const commandItems: CommandItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Panoramica del sistema',
    icon: <Home className="h-4 w-4" />,
    href: '/dashboard',
    keywords: ['home', 'panoramica', 'principale'],
    category: 'Navigazione',
  },
  {
    id: 'projects',
    title: 'Progetti',
    description: 'Gestisci i tuoi progetti',
    icon: <FolderGit2 className="h-4 w-4" />,
    href: '/dashboard/projects',
    keywords: ['project', 'app', 'applicazione', 'pm2'],
    category: 'Risorse',
  },
  {
    id: 'containers',
    title: 'Container Docker',
    description: 'Gestisci container',
    icon: <Container className="h-4 w-4" />,
    href: '/dashboard/containers',
    keywords: ['docker', 'container', 'immagine'],
    category: 'Risorse',
  },
  {
    id: 'databases',
    title: 'Database',
    description: 'PostgreSQL, MySQL, Redis',
    icon: <Database className="h-4 w-4" />,
    href: '/dashboard/databases',
    keywords: ['db', 'postgres', 'mysql', 'redis', 'sql'],
    category: 'Risorse',
  },
  {
    id: 'domains',
    title: 'Domini',
    description: 'Gestisci domini e SSL',
    icon: <Globe className="h-4 w-4" />,
    href: '/dashboard/domains',
    keywords: ['domain', 'ssl', 'https', 'certificato', 'dns'],
    category: 'Risorse',
  },
  {
    id: 'emails',
    title: 'Email',
    description: 'Account email',
    icon: <Mail className="h-4 w-4" />,
    href: '/dashboard/emails',
    keywords: ['mail', 'posta', 'smtp'],
    category: 'Risorse',
  },
  {
    id: 'backups',
    title: 'Backup',
    description: 'Gestisci backup',
    icon: <HardDrive className="h-4 w-4" />,
    href: '/dashboard/backups',
    keywords: ['backup', 'restore', 'ripristino', 'salvataggio'],
    category: 'Risorse',
  },
  {
    id: 'monitoring',
    title: 'Monitoraggio',
    description: 'Metriche e performance',
    icon: <Activity className="h-4 w-4" />,
    href: '/dashboard/monitoring',
    keywords: ['monitor', 'cpu', 'ram', 'disk', 'metriche', 'performance'],
    category: 'Sistema',
  },
  {
    id: 'security',
    title: 'Sicurezza',
    description: 'Audit e sicurezza',
    icon: <Shield className="h-4 w-4" />,
    href: '/dashboard/security',
    keywords: ['security', 'audit', 'firewall', 'protezione'],
    category: 'Sistema',
  },
  {
    id: 'logs',
    title: 'Log Attivita',
    description: 'Cronologia operazioni',
    icon: <FileText className="h-4 w-4" />,
    href: '/dashboard/activity',
    keywords: ['log', 'attivita', 'cronologia', 'storia'],
    category: 'Sistema',
  },
  {
    id: 'users',
    title: 'Utenti',
    description: 'Gestisci utenti',
    icon: <Users className="h-4 w-4" />,
    href: '/dashboard/users',
    keywords: ['user', 'utente', 'account', 'permessi'],
    category: 'Admin',
  },
  {
    id: 'settings',
    title: 'Impostazioni',
    description: 'Configurazione sistema',
    icon: <Settings className="h-4 w-4" />,
    href: '/dashboard/settings',
    keywords: ['settings', 'config', 'preferenze', 'opzioni'],
    category: 'Admin',
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return commandItems;

    const searchLower = search.toLowerCase();
    return commandItems.filter(item =>
      item.title.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      item.keywords.some(k => k.includes(searchLower))
    );
  }, [search]);

  // Group by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredItems.forEach(item => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle navigation in list
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredItems.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredItems.length - 1
        );
      } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredItems[selectedIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredItems, selectedIndex]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleSelect = useCallback((item: CommandItem) => {
    setOpen(false);
    setSearch('');
    router.push(item.href);
  }, [router]);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, []);

  let flatIndex = 0;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md border border-input bg-background hover:bg-accent transition-colors"
        aria-label="Apri ricerca globale (Cmd+K)"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Cerca...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono bg-muted rounded">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="p-0 max-w-lg overflow-hidden">
          <VisuallyHidden>
            <DialogTitle>Ricerca Globale</DialogTitle>
            <DialogDescription>
              Cerca pagine, comandi e risorse all'interno del VPS Panel
            </DialogDescription>
          </VisuallyHidden>
          {/* Search input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca pagine, comandi..."
              className="border-0 focus-visible:ring-0 px-0 text-base"
              autoFocus
              aria-label="Campo di ricerca"
              role="searchbox"
            />
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label="Risultati di ricerca">
            {Object.keys(groupedItems).length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                Nessun risultato per "{search}"
              </p>
            ) : (
              Object.entries(groupedItems).map(([category, items]) => (
                <div key={category} className="mb-2">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                    {category}
                  </p>
                  {items.map((item) => {
                    const currentIndex = flatIndex++;
                    const isSelected = currentIndex === selectedIndex;

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                          isSelected
                            ? 'bg-accent text-accent-foreground'
                            : 'text-foreground hover:bg-accent/50'
                        )}
                        role="option"
                        aria-selected={isSelected}
                        aria-label={`${item.title}: ${item.description || ''}`}
                      >
                        <div className="shrink-0 text-muted-foreground">
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{item.title}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded">↑↓</kbd> naviga
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded">↵</kbd> seleziona
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded">esc</kbd> chiudi
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
