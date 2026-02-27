'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderGit2,
  Container,
  Globe,
  Database,
  Mail,
  FileText,
  Settings,
  Activity,
  Users,
  ClipboardList,
  Package,
  Zap,
  Shield,
  Wrench,
  LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import Image from 'next/image';
import { VERSION } from '@/lib/version';
import { motion } from 'framer-motion';
import { ChangelogDialog } from '@/components/changelog/ChangelogDialog';

// ============================================
// NAVIGATION CONFIG
// ============================================

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Progetti', href: '/dashboard/projects', icon: FolderGit2 },
  { name: 'Container', href: '/dashboard/containers', icon: Container },
  { name: 'Database', href: '/dashboard/databases', icon: Database },
  { name: 'Domini', href: '/dashboard/domains', icon: Globe },
  { name: 'File Manager', href: '/dashboard/files', icon: FileText },
  { name: 'Backup', href: '/dashboard/backups', icon: Package },
  { name: 'Email', href: '/dashboard/email', icon: Mail },
  { name: 'Automazioni & Tools', href: '/dashboard/automazioni-tools', icon: Zap },
  { name: 'Manutenzione', href: '/dashboard/maintenance', icon: Wrench },
  { name: 'Monitoraggio', href: '/dashboard/monitoring', icon: Activity },
];

const adminNavigation: NavItem[] = [
  { name: 'Utenti', href: '/dashboard/users', icon: Users },
  { name: 'Log Attivita', href: '/dashboard/activity', icon: ClipboardList },
  { name: 'Sicurezza', href: '/dashboard/security', icon: Shield },
  { name: 'Impostazioni', href: '/dashboard/settings', icon: Settings },
];

// ============================================
// NAV ITEM COMPONENT
// ============================================

interface NavItemProps {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}

function NavItemLink({ item, isActive, onClick }: NavItemProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className="relative block group"
      aria-label={`Vai a ${item.name}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <motion.div
        className={cn(
          'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        )}
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Active indicator bar */}
        {isActive && (
          <motion.div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-gradient-to-b from-primary to-primary/60"
            layoutId="activeIndicator"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          />
        )}

        <div className={cn(
          'p-1.5 rounded-lg transition-all duration-200',
          isActive
            ? 'bg-primary/15'
            : 'group-hover:bg-accent'
        )}>
          <Icon className={cn(
            'h-4 w-4 flex-shrink-0 transition-transform duration-200',
            isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
            'group-hover:scale-110'
          )} />
        </div>

        <span className="truncate">{item.name}</span>

        {/* Hover glow effect */}
        {isActive && (
          <div className="absolute inset-0 rounded-xl bg-primary/5 blur-sm pointer-events-none" />
        )}
      </motion.div>
    </Link>
  );
}

// ============================================
// SECTION HEADER
// ============================================

interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className="px-3 mb-3 mt-6 pt-6 border-t border-border/50">
      <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">
        {title}
      </p>
    </div>
  );
}

// ============================================
// SIDEBAR COMPONENT
// ============================================

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdmin = user?.role === 'ADMIN';

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === href;
    }
    return pathname === href || pathname?.startsWith(href + '/');
  };

  // Determina quale logo mostrare in base al tema
  // logo.png = testo bianco (per sfondo scuro)
  // logo-light.png = testo nero (per sfondo chiaro)
  const logoSrc = mounted && resolvedTheme === 'dark' ? '/logo.png' : '/logo-light.png';

  return (
    <div className="flex h-full w-64 flex-col glass border-r border-border/50">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-border/50">
        <Link href="/dashboard" className="flex items-center gap-2" aria-label="Torna alla dashboard">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Image
              src={logoSrc}
              alt="FODI"
              width={120}
              height={42}
              className="h-8 w-auto"
              priority
            />
          </motion.div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-thin" aria-label="Navigazione principale">
        {/* Main Navigation */}
        <motion.div
          className="space-y-1"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, staggerChildren: 0.05 }}
        >
          {navigation.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <NavItemLink
                item={item}
                isActive={isActive(item.href)}
                onClick={onNavigate}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <SectionHeader title="Amministrazione" />
            <div className="space-y-1">
              {adminNavigation.map((item) => (
                <NavItemLink
                  key={item.name}
                  item={item}
                  isActive={isActive(item.href)}
                  onClick={onNavigate}
                />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* Footer with Status & Version */}
      <div className="border-t border-border/50 p-4">
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-2">
            <span className="status-dot status-dot-healthy status-dot-pulse" />
            <p className="text-xs text-muted-foreground">
              Sistema OK
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
              className="text-xs font-mono text-muted-foreground/60 bg-muted/50 w-5 h-5 rounded flex items-center justify-center hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Scorciatoie tastiera (?)"
            >
              ?
            </button>
            <button
              onClick={() => setChangelogOpen(true)}
              className="text-xs font-semibold text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer"
              title="Visualizza changelog"
            >
              v{VERSION}
            </button>
          </div>
        </motion.div>
      </div>

      {/* Modals */}
      <ChangelogDialog open={changelogOpen} onOpenChange={setChangelogOpen} />
    </div>
  );
}

export default Sidebar;
