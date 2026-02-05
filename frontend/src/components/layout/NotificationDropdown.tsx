'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useNotificationStore,
  Notification,
  NotificationType,
} from '@/store/notificationStore';
import { useProjectsWebSocket } from '@/hooks/useProjectsWebSocket';

const typeConfig: Record<NotificationType, { icon: typeof Info; color: string }> = {
  info: { icon: Info, color: 'text-primary' },
  success: { icon: CheckCircle, color: 'text-success' },
  warning: { icon: AlertTriangle, color: 'text-warning' },
  error: { icon: XCircle, color: 'text-destructive' },
};

function NotificationItem({
  notification,
  onMarkAsRead,
  onRemove,
  onAction,
}: {
  notification: Notification;
  onMarkAsRead: () => void;
  onRemove: () => void;
  onAction?: () => void;
}) {
  const config = typeConfig[notification.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'group relative flex gap-3 p-3 border-b border-border/50 last:border-0 transition-colors',
        !notification.read && 'bg-primary/5'
      )}
    >
      {/* Icon */}
      <div className={cn('mt-0.5 flex-shrink-0', config.color)}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium', !notification.read && 'text-foreground')}>
            {notification.title}
          </p>
          {!notification.read && (
            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground/70">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
              locale: it,
            })}
          </span>
          {notification.actionLabel && notification.actionHref && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-primary"
              onClick={onAction}
            >
              {notification.actionLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Actions (show on hover) */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead();
            }}
            title="Segna come letto"
            aria-label="Segna notifica come letta"
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Rimuovi"
          aria-label="Rimuovi notifica"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

type NotificationFilter = 'all' | 'deploy' | 'alert' | 'system';

export function NotificationDropdown() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    addFromWebSocket,
    setUnreadCount,
  } = useNotificationStore();

  // Fetch on mount
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  // WebSocket for real-time updates
  useProjectsWebSocket({
    onNotificationNew: (data) => {
      addFromWebSocket(data);
    },
    onNotificationCount: (data) => {
      if (data.userId && data.count !== undefined) {
        setUnreadCount(data.count);
      }
    },
  });

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'deploy') return n.source === 'deployment' || n.title?.toLowerCase().includes('deploy');
    if (filter === 'alert') return n.type === 'warning' || n.type === 'error';
    if (filter === 'system') return n.source === 'system' || n.source === 'backup' || n.source === 'resource';
    return true;
  });

  const handleAction = (notification: Notification) => {
    if (notification.actionHref) {
      router.push(notification.actionHref);
      setOpen(false);
    }
    if (!notification.read) {
      markAsRead(notification.id);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-accent relative"
          aria-label={unreadCount > 0 ? `Notifiche (${unreadCount} non lette)` : 'Notifiche'}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notifiche</h3>
          {notifications.length > 0 && (
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={markAllAsRead}
                  aria-label="Segna tutte le notifiche come lette"
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Letti tutti
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={clearAll}
                aria-label="Cancella tutte le notifiche"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border/50 overflow-x-auto">
            {([
              { key: 'all', label: 'Tutte' },
              { key: 'deploy', label: 'Deploy' },
              { key: 'alert', label: 'Alert' },
              { key: 'system', label: 'Sistema' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                  filter === key
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Notifications List */}
        {filteredNotifications.length > 0 ? (
          <ScrollArea className="max-h-[400px]">
            {filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={() => markAsRead(notification.id)}
                onRemove={() => removeNotification(notification.id)}
                onAction={() => handleAction(notification)}
              />
            ))}
          </ScrollArea>
        ) : (
          <div className="py-8 text-center">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">
              {filter !== 'all' ? 'Nessuna notifica per questo filtro' : 'Nessuna notifica'}
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
