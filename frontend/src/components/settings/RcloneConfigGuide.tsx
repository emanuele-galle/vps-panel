"use client";

import { useState } from "react";
import { AlertTriangle, Copy, CheckCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function RcloneConfigGuide() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border-warning/30">
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Configurazione Google Drive Richiesta
            </h3>
            <p className="text-sm text-muted-foreground">
              Completa la configurazione per abilitare i backup su Google Drive
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-warning/10 rounded-lg p-4">
          <h4 className="font-medium text-warning mb-3">
            Opzione 1: Service Account (Consigliata per automazione)
          </h4>
          <ol className="text-sm text-warning space-y-2 list-decimal list-inside">
            <li>
              Vai su{" "}
              <a
                href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-1"
              >
                Google Cloud Console <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>Crea un nuovo Service Account</li>
            <li>Abilita Google Drive API per il progetto</li>
            <li>Crea una chiave JSON per il Service Account</li>
            <li>Carica il file JSON usando il form sotto</li>
          </ol>
        </div>

        <div className="bg-primary/10 rounded-lg p-4">
          <h4 className="font-medium text-primary mb-3">
            Opzione 2: Configurazione Manuale via SSH
          </h4>
          <p className="text-sm text-primary mb-3">
            Esegui questo comando via SSH sul server:
          </p>
          <div className="relative">
            <code className="block bg-primary/20 p-3 rounded text-xs font-mono overflow-x-auto">
              sudo /opt/backups/scripts/configure-rclone-gdrive.sh
            </code>
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={() => copyToClipboard("sudo /opt/backups/scripts/configure-rclone-gdrive.sh")}
            >
              {copied ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Copiato
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copia
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-primary mt-2">
            Lo script ti guiderà nell'autenticazione OAuth con Google
          </p>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-2">
            Importante:
          </h4>
          <ul className="text-xs text-foreground space-y-1 list-disc list-inside">
            <li>Il Service Account deve avere accesso a Google Drive API</li>
            <li>Assicurati di condividere la cartella backup con il Service Account email</li>
            <li>Dopo la configurazione, ricarica questa pagina</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
