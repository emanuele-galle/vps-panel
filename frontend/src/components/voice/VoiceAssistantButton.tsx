'use client';

import { useState, useCallback, useEffect } from 'react';
import { Mic, MicOff, Volume2, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

// Agent ID per l'Internal Agent (solo monitoraggio VPS)
const INTERNAL_AGENT_ID = 'agent_7601kb5rb41xe7etmt4e387mk9np';

interface VoiceAssistantButtonProps {
  className?: string;
}

export function VoiceAssistantButton({ className }: VoiceAssistantButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user, isAuthenticated } = useAuthStore();

  // Solo utenti autenticati possono usare l'assistente interno
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'flex items-center justify-center',
          'w-14 h-14 rounded-full',
          'bg-gradient-to-r from-blue-600 to-purple-600',
          'shadow-lg hover:shadow-xl',
          'transition-all duration-300',
          'hover:scale-110',
          'group',
          className
        )}
        title="Assistente Vocale VPS"
      >
        <Mic className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full animate-pulse" />
      </button>

      {/* Modal */}
      {isOpen && (
        <VoiceAssistantModal
          onClose={() => setIsOpen(false)}
          userName={user.name || user.email}
        />
      )}
    </>
  );
}

interface VoiceAssistantModalProps {
  onClose: () => void;
  userName: string;
}

function VoiceAssistantModal({ onClose, userName }: VoiceAssistantModalProps) {
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  useEffect(() => {
    // Carica lo script del widget ElevenLabs
    const existingScript = document.querySelector('script[src*="elevenlabs"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
      script.async = true;
      script.onload = () => setWidgetLoaded(true);
      document.body.appendChild(script);
    } else {
      setWidgetLoaded(true);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-card rounded-2xl shadow-2xl overflow-hidden border border-border">
          {/* Header */}
          <div className="relative px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-card/20 transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-card/20 rounded-full">
                <Volume2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Assistente VPS
                </h3>
                <p className="text-sm text-white/80">
                  Ciao {userName.split(' ')[0] || 'Staff'}!
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-3">
                Parla con l'assistente per monitorare i sistemi VPS:
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• "Come sta il server?"</li>
                <li>• "Quanti container sono attivi?"</li>
                <li>• "Qual è lo stato di saas-tattoo?"</li>
                <li>• "Mostrami le attività recenti"</li>
              </ul>
            </div>

            {/* Widget Container */}
            <div className="relative min-h-[200px] flex items-center justify-center">
              {!widgetLoaded ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <span className="text-sm text-muted-foreground">Caricamento...</span>
                </div>
              ) : (
                <div className="w-full flex justify-center">
                  {/* @ts-ignore - ElevenLabs custom element */}
                  <elevenlabs-convai
                    agent-id={INTERNAL_AGENT_ID}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-card/50 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Powered by ElevenLabs AI • Solo uso interno
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dichiarazione del tipo per l'elemento custom
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { 'agent-id': string },
        HTMLElement
      >;
    }
  }
}
