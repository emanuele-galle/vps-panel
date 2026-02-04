'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CHANGELOG_MD, VERSION, VERSION_DATE } from '@/lib/version';
import { FileText, X } from 'lucide-react';

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangelogDialog({ open, onOpenChange }: ChangelogDialogProps) {
  // Parse markdown changelog in sections
  const sections = CHANGELOG_MD.split('## ').slice(1); // Skip header

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <DialogTitle>Changelog VPS Console</DialogTitle>
            </div>
            <span className="text-xs font-semibold text-primary/80 bg-primary/10 px-3 py-1 rounded-full">
              v{VERSION}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Ultima release: {VERSION_DATE}
          </p>
        </DialogHeader>

        <ScrollArea className="h-[calc(85vh-150px)] pr-4">
          <div className="space-y-6">
            {sections.map((section, index) => {
              const lines = section.split('\n');
              const title = lines[0].trim();
              const content = lines.slice(1).join('\n');

              // Detect version header
              const isVersionHeader = title.match(/^\[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/);

              return (
                <div key={index} className="border-b border-border/50 pb-6 last:border-0">
                  {isVersionHeader ? (
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-lg font-bold text-foreground">
                        v{isVersionHeader[1]}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {isVersionHeader[2]}
                      </span>
                    </div>
                  ) : (
                    <h3 className="text-lg font-bold text-foreground mb-4">
                      {title}
                    </h3>
                  )}
                  
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ChangelogContent content={content} />
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Component to render markdown-like content
function ChangelogContent({ content }: { content: string }) {
  const lines = content.split('\n').filter(line => line.trim());

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        line = line.trim();

        // H3 headers (###)
        if (line.startsWith('### ')) {
          return (
            <h4 key={index} className="font-semibold text-foreground mt-4 mb-2">
              {line.replace('### ', '')}
            </h4>
          );
        }

        // List items (-)
        if (line.startsWith('- ')) {
          const listItem = line.replace('- ', '');
          return (
            <li key={index} className="text-sm text-muted-foreground ml-4">
              <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(listItem) }} />
            </li>
          );
        }

        // Bold headers (**text**)
        if (line.startsWith('**') && line.endsWith('**')) {
          return (
            <p key={index} className="font-semibold text-foreground mt-3">
              {line.replace(/\*\*/g, '')}
            </p>
          );
        }

        // Separator (---)
        if (line === '---') {
          return <hr key={index} className="my-6 border-border/50" />;
        }

        // Regular paragraph
        if (line.length > 0) {
          return (
            <p key={index} className="text-sm text-muted-foreground">
              <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }} />
            </p>
          );
        }

        return null;
      })}
    </div>
  );
}

// Format inline markdown (bold, code, etc.)
function formatInlineMarkdown(text: string): string {
  // Bold **text**
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Inline code `text`
  text = text.replace(/`(.*?)`/g, '<code class="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs">$1</code>');
  
  // Links [text](url)
  text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');

  return text;
}
