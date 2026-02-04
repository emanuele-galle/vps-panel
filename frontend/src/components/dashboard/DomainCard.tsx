'use client';

import { useState } from 'react';
import { ExternalLink, Trash2, Shield, ShieldOff, Globe, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDomainsStore } from '@/store/domainsStore';
import { Domain } from '@/types';

interface DomainCardProps {
  domain: Domain;
}

export function DomainCard({ domain }: DomainCardProps) {
  const { updateDomain, deleteDomain } = useDomainsStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleSSL = async () => {
    setIsLoading(true);
    try {
      await updateDomain(domain.id, {
        sslEnabled: !domain.sslEnabled,
      });
    } catch (error: any) {
      console.error('Failed to toggle SSL:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async () => {
    setIsLoading(true);
    try {
      await updateDomain(domain.id, {
        isActive: !domain.isActive,
      });
    } catch (error: any) {
      console.error('Failed to toggle active status:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete "${domain.domain}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteDomain(domain.id);
    } catch (error: any) {
      console.error('Failed to delete domain:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDomain = () => {
    const protocol = domain.sslEnabled ? 'https' : 'http';
    window.open(`${protocol}://${domain.domain}`, '_blank');
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">
                {domain.domain}
              </h3>
            </div>
            {domain.project && (
              <p className="text-sm text-muted-foreground mt-1">
                Project: {domain.project.name}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Badge variant={domain.isActive ? 'success' : 'error'}>
              {domain.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {domain.sslEnabled && (
              <Badge variant="success">
                <Shield className="h-3 w-3 mr-1" />
                SSL
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="space-y-3">
          {domain.sslProvider && (
            <div>
              <p className="text-xs text-muted-foreground">
                SSL Provider
              </p>
              <p className="text-sm font-medium text-foreground capitalize">
                {domain.sslProvider.toLowerCase()}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground">Creato</p>
            <p className="text-sm text-foreground">
              {new Date(domain.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Last Updated</p>
            <p className="text-sm text-foreground">
              {new Date(domain.updatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-border">
        <div className="flex flex-col w-full gap-2">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDomain}
              disabled={!domain.isActive}
              className="h-8"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Visit
            </Button>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSSL}
                disabled={isLoading}
                className="h-8"
                title={domain.sslEnabled ? 'Disable SSL' : 'Enable SSL'}
              >
                {domain.sslEnabled ? (
                  <Shield className="h-3.5 w-3.5" />
                ) : (
                  <ShieldOff className="h-3.5 w-3.5" />
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleActive}
                disabled={isLoading}
                className="h-8"
                title={domain.isActive ? 'Deactivate' : 'Activate'}
              >
                {domain.isActive ? (
                  <CheckCircle className="h-3.5 w-3.5 text-success" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={isLoading}
                className="h-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10 dark:text-destructive hover:bg-destructive/15"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
