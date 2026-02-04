'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Command, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react';

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigazione',
    shortcuts: [
      { keys: ['Cmd', 'K'], description: 'Apri ricerca globale' },
      { keys: ['G', 'D'], description: 'Vai a Dashboard' },
      { keys: ['G', 'P'], description: 'Vai a Progetti' },
      { keys: ['G', 'C'], description: 'Vai a Container' },
      { keys: ['G', 'B'], description: 'Vai a Database' },
      { keys: ['G', 'M'], description: 'Vai a Monitoraggio' },
      { keys: ['G', 'S'], description: 'Vai a Impostazioni' },
    ],
  },
  {
    title: 'Ricerca Globale',
    shortcuts: [
      { keys: ['ArrowUp', 'ArrowDown'], description: 'Naviga risultati' },
      { keys: ['Enter'], description: 'Seleziona risultato' },
      { keys: ['Esc'], description: 'Chiudi ricerca' },
    ],
  },
  {
    title: 'Azioni Rapide',
    shortcuts: [
      { keys: ['Click Destro'], description: 'Menu contestuale su card progetto' },
    ],
  },
  {
    title: 'Generale',
    shortcuts: [
      { keys: ['?'], description: 'Mostra shortcuts' },
      { keys: ['Esc'], description: 'Chiudi modal/dialog' },
    ],
  },
];

function KeyIcon({ keyName }: { keyName: string }) {
  if (keyName === 'Cmd') {
    return <Command className="h-3 w-3" />;
  }
  if (keyName === 'ArrowUp') {
    return <ArrowUp className="h-3 w-3" />;
  }
  if (keyName === 'ArrowDown') {
    return <ArrowDown className="h-3 w-3" />;
  }
  if (keyName === 'Enter') {
    return <CornerDownLeft className="h-3 w-3" />;
  }
  return <span>{keyName}</span>;
}

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Scorciatoie da Tastiera
          </DialogTitle>
          <DialogDescription>
            Elenco completo delle scorciatoie da tastiera disponibili nel VPS Panel
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-sm text-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx} className="flex items-center">
                          <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono bg-muted border border-border rounded shadow-sm">
                            <KeyIcon keyName={key} />
                          </kbd>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="mx-0.5 text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Premi <kbd className="px-1 py-0.5 bg-muted rounded text-xs">?</kbd> in qualsiasi momento per vedere questa guida
        </div>
      </DialogContent>
    </Dialog>
  );
}
