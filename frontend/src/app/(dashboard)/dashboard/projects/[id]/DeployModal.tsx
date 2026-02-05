'use client';

import { useEffect, useRef, useState } from 'react';
import {
  GitBranch,
  Hammer,
  Rocket,
  HeartPulse,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type DeployStep = 'git_pull' | 'build' | 'deploy' | 'health_check';
type DeployStatus = 'PENDING' | 'GIT_PULLING' | 'BUILDING' | 'DEPLOYING' | 'HEALTH_CHECK' | 'SUCCESS' | 'FAILED';

const STEPS: { key: DeployStep; label: string; icon: typeof GitBranch; statusMatch: DeployStatus[] }[] = [
  { key: 'git_pull', label: 'Git Pull', icon: GitBranch, statusMatch: ['GIT_PULLING'] },
  { key: 'build', label: 'Build', icon: Hammer, statusMatch: ['BUILDING'] },
  { key: 'deploy', label: 'Deploy', icon: Rocket, statusMatch: ['DEPLOYING'] },
  { key: 'health_check', label: 'Health Check', icon: HeartPulse, statusMatch: ['HEALTH_CHECK'] },
];

interface DeployModalProps {
  open: boolean;
  onClose: () => void;
  deploymentId: string | null;
  status: DeployStatus;
  currentStep: string | null;
  logs: string[];
  duration?: number | null;
  error?: string | null;
}

export function DeployModal({
  open,
  onClose,
  deploymentId,
  status,
  currentStep,
  logs,
  duration,
  error,
}: DeployModalProps) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getStepState = (step: typeof STEPS[number]): 'pending' | 'active' | 'completed' | 'failed' => {
    if (status === 'FAILED') {
      const stepIdx = STEPS.findIndex(s => s.key === step.key);
      const currentIdx = STEPS.findIndex(s => s.statusMatch.some(sm => sm === status) || s.key === currentStep);
      if (step.statusMatch.some(sm => sm === currentStep as any)) return 'failed';
      if (stepIdx < currentIdx || (currentIdx === -1 && stepIdx < STEPS.length)) return 'completed';
      return 'pending';
    }
    if (status === 'SUCCESS') return 'completed';
    if (step.statusMatch.some(sm => sm === status)) return 'active';
    const stepIdx = STEPS.findIndex(s => s.key === step.key);
    const activeIdx = STEPS.findIndex(s => s.statusMatch.some(sm => sm === status));
    if (activeIdx >= 0 && stepIdx < activeIdx) return 'completed';
    return 'pending';
  };

  const isFinished = status === 'SUCCESS' || status === 'FAILED';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && isFinished) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-indigo-500" />
            Deploy in corso
            {status === 'SUCCESS' && <span className="text-sm font-normal text-green-500 ml-2">Completato{duration ? ` in ${duration}s` : ''}</span>}
            {status === 'FAILED' && <span className="text-sm font-normal text-red-500 ml-2">Fallito</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="px-4 py-3 bg-muted/50 rounded-lg">
          {/* Step counter */}
          <div className="text-center mb-3">
            <span className="text-xs font-medium text-muted-foreground">
              Fase {Math.min(STEPS.findIndex(s => s.statusMatch.some(sm => sm === status)) + 1 || (status === 'SUCCESS' ? 4 : status === 'PENDING' ? 0 : 1), 4)}/{STEPS.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const state = getStepState(step);
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center gap-2 flex-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`relative p-2 rounded-full transition-colors ${
                        state === 'completed' ? 'bg-green-500/20 text-green-500' :
                        state === 'active' ? 'bg-blue-500/20 text-blue-500 animate-pulse' :
                        state === 'failed' ? 'bg-red-500/20 text-red-500' :
                        'bg-muted text-muted-foreground'
                      }`}
                    >
                      {state === 'completed' ? <Check className="h-4 w-4" /> :
                       state === 'failed' ? <X className="h-4 w-4" /> :
                       state === 'active' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                       <Icon className="h-4 w-4" />}
                      <span className={`absolute -top-1 -right-1 text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                        state === 'completed' ? 'bg-green-500 text-white' :
                        state === 'active' ? 'bg-blue-500 text-white' :
                        state === 'failed' ? 'bg-red-500 text-white' :
                        'bg-muted-foreground/30 text-muted-foreground'
                      }`}>
                        {idx + 1}
                      </span>
                    </div>
                    <span className={`text-xs font-medium ${
                      state === 'completed' ? 'text-green-500' :
                      state === 'active' ? 'text-blue-500' :
                      state === 'failed' ? 'text-red-500' :
                      'text-muted-foreground'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 rounded transition-colors ${
                      state === 'completed' ? 'bg-green-500' : 'bg-border'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Log Area */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg text-xs font-mono overflow-auto max-h-96 min-h-[200px] whitespace-pre-wrap break-all">
            {logs.length === 0 ? (
              <span className="text-slate-500">In attesa dei log...</span>
            ) : (
              logs.map((line, i) => (
                <div key={i} className={
                  line.includes('[stderr]') ? 'text-yellow-400' :
                  line.includes('STEP') ? 'text-cyan-400 font-bold' :
                  line.includes('health') ? 'text-purple-400' :
                  line.includes('ERROR') || line.includes('fallito') ? 'text-red-400' :
                  line.includes('completato') || line.includes('running') ? 'text-green-400' :
                  ''
                }>
                  {line}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </pre>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Close button */}
        {isFinished && (
          <div className="flex justify-end pt-2">
            <Button onClick={onClose}>
              Chiudi
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
