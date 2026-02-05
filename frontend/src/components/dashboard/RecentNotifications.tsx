'use client';

import { Bell, ChevronRight, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';
import { Skeleton } from '@/components/ui/skeleton';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  read: boolean;
  actionHref?: string;
  createdAt: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  SUCCESS: { icon: CheckCircle, color: 'text-green-500' },
  ERROR: { icon: XCircle, color: 'text-red-500' },
  WARNING: { icon: AlertTriangle, color: 'text-amber-500' },
  INFO: { icon: Info, color: 'text-blue-500' },
};

function RecentNotificationsSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg">
          <Skeleton className="h-4 w-4 mt-0.5 rounded-full flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecentNotifications({ notifications, isLoading }: { notifications: Notification[]; isLoading?: boolean }) {
  return (
    <motion.div variants={fadeInUp}>
      <Card className="glass border-border/50 h-full">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold">Notifiche Recenti</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {isLoading ? (
            <RecentNotificationsSkeleton />
          ) : notifications.length > 0 ? (
            <div className="space-y-2">
              {notifications.map((notif, index) => {
                const tc = typeConfig[notif.type] || typeConfig.INFO;
                const Icon = tc.icon;

                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {notif.actionHref ? (
                      <Link
                        href={notif.actionHref}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors group"
                      >
                        <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${tc.color}`} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground text-sm truncate group-hover:text-primary transition-colors">
                            {notif.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {notif.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: it })}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors">
                        <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${tc.color}`} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground text-sm truncate">
                            {notif.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {notif.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: it })}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <Bell className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nessuna notifica recente</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
