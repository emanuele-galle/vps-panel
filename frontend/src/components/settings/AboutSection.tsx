'use client';

import { useState } from 'react';
import {
  Info,
  Building2,
  Calendar,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  FileText,
  Cpu,
  Target,
} from 'lucide-react';
import { VERSION, VERSION_DATE, CHANGELOG, ABOUT_INFO } from '@/lib/version';

export function AboutSection() {
  const [showFullChangelog, setShowFullChangelog] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['info'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const sections = [
    {
      id: 'info',
      title: 'Informazioni Console',
      icon: Info,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="text-lg font-semibold text-foreground">
                {ABOUT_INFO.name}
              </p>
            </div>
            <div className="bg-muted/50/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Versione</p>
              <p className="text-lg font-semibold text-primary">
                v{VERSION}
              </p>
            </div>
            <div className="bg-muted/50/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Data Release</p>
              <p className="text-lg font-semibold text-foreground">
                {VERSION_DATE}
              </p>
            </div>
            <div className="bg-muted/50/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Sviluppatore</p>
              <p className="text-lg font-semibold text-foreground">
                {ABOUT_INFO.developer.company}
              </p>
            </div>
          </div>
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <p className="text-sm text-primary whitespace-pre-line">
              {ABOUT_INFO.description}
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'purpose',
      title: 'Scopo e Destinazione',
      icon: Target,
      content: (
        <div className="bg-muted/50/50 rounded-lg p-4">
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans">
            {ABOUT_INFO.purpose}
          </pre>
        </div>
      ),
    },
    {
      id: 'architecture',
      title: 'Architettura e Stack',
      icon: Cpu,
      content: (
        <div className="bg-card dark:bg-background rounded-lg p-4">
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
            {ABOUT_INFO.architecture}
          </pre>
        </div>
      ),
    },
    {
      id: 'features',
      title: 'Funzionalita',
      icon: CheckCircle,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ABOUT_INFO.features.map((feature, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-muted/50/50 rounded-lg"
            >
              <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
              <span className="text-sm text-foreground">{feature}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'changelog',
      title: 'Changelog',
      icon: FileText,
      content: (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Storico completo delle modifiche
            </p>
            <button
              onClick={() => setShowFullChangelog(!showFullChangelog)}
              className="text-sm text-primary hover:underline"
            >
              {showFullChangelog ? 'Comprimi' : 'Espandi tutto'}
            </button>
          </div>
          <div
            className={`bg-card dark:bg-background rounded-lg p-4 overflow-auto ${
              showFullChangelog ? 'max-h-[600px]' : 'max-h-[300px]'
            }`}
          >
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
              {CHANGELOG}
            </pre>
          </div>
        </div>
      ),
    },
    {
      id: 'developer',
      title: 'Sviluppatore',
      icon: Building2,
      content: (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">F</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">
                {ABOUT_INFO.developer.company}
              </h3>
              <p className="text-muted-foreground">
                Sviluppo Software e Soluzioni Digitali
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href={ABOUT_INFO.developer.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 bg-muted/50/50 rounded-lg hover:bg-muted hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-5 w-5 text-primary" />
              <span className="text-foreground">
                {ABOUT_INFO.developer.website}
              </span>
            </a>
            <a
              href={`mailto:${ABOUT_INFO.developer.email}`}
              className="flex items-center gap-2 p-3 bg-muted/50/50 rounded-lg hover:bg-muted hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-5 w-5 text-primary" />
              <span className="text-foreground">
                {ABOUT_INFO.developer.email}
              </span>
            </a>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Version Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{ABOUT_INFO.name}</h2>
            <p className="text-primary-foreground mt-1">{ABOUT_INFO.fullName}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">v{VERSION}</p>
            <p className="text-primary-foreground text-sm flex items-center gap-1 justify-end">
              <Calendar className="h-4 w-4" />
              {VERSION_DATE}
            </p>
          </div>
        </div>
      </div>

      {/* Collapsible Sections */}
      {sections.map((section) => {
        const Icon = section.icon;
        const isExpanded = expandedSections.has(section.id);

        return (
          <div
            key={section.id}
            className="bg-card border border-border rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-accent dark:hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">
                  {section.title}
                </span>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border pt-4">
                {section.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
