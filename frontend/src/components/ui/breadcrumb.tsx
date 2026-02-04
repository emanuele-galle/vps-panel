'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

// Map paths to italian labels
const pathLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Progetti',
  containers: 'Container',
  databases: 'Database',
  monitoring: 'Monitoraggio',
  settings: 'Impostazioni',
  users: 'Utenti',
  activity: 'Attività',
  backups: 'Backup',
  domains: 'Domini',
  email: 'Email',
  files: 'File Manager',
  n8n: 'Automazioni',
  assets: 'Risorse',
  'system-settings': 'Sistema',
};

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items: customItems, className }: BreadcrumbProps) {
  const pathname = usePathname();

  // Generate items from pathname if not provided
  const items: BreadcrumbItem[] = customItems || generateBreadcrumbs(pathname);

  if (items.length <= 1) {
    return null; // Don't show breadcrumb for root paths
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center text-sm text-muted-foreground', className)}
    >
      <ol className="flex items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.href || item.label} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              )}
              {isLast || !item.href ? (
                <span
                  className={cn(
                    'px-1',
                    isLast && 'font-medium text-foreground'
                  )}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="px-1 hover:text-foreground transition-colors"
                >
                  {index === 0 ? (
                    <span className="flex items-center gap-1">
                      <Home className="h-4 w-4" />
                      <span className="sr-only">{item.label}</span>
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [];
  }

  const items: BreadcrumbItem[] = [];

  // Build cumulative paths
  let currentPath = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Check if it's a dynamic segment (UUID or similar)
    const isDynamic = isUUID(segment) || segment.length > 20;

    // Get label - use path labels or format the segment
    let label = pathLabels[segment] || formatSegment(segment);

    // For dynamic segments, just show a generic label
    if (isDynamic) {
      label = 'Dettaglio';
    }

    items.push({
      label,
      href: i < segments.length - 1 ? currentPath : undefined, // Last item has no link
    });
  }

  return items;
}

function formatSegment(segment: string): string {
  // Convert kebab-case or snake_case to Title Case
  return segment
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isUUID(str: string): boolean {
  // Check if string looks like a UUID or CUID
  const uuidPattern = /^[a-f0-9-]{36}$/i;
  const cuidPattern = /^c[a-z0-9]{24,}$/;
  return uuidPattern.test(str) || cuidPattern.test(str);
}

// Hook to use breadcrumb context
export function useBreadcrumb() {
  const pathname = usePathname();
  return {
    items: generateBreadcrumbs(pathname),
    pathname,
  };
}
