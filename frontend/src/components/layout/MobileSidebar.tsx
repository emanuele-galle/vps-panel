'use client';

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useMobileSidebar } from '@/hooks/useMobileSidebar';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MobileSidebar() {
  const { isOpen, close, toggle } = useMobileSidebar();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-accent"
          onClick={toggle}
          aria-label="Menu navigazione"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64 bg-card border-r border-border">
        <Sidebar onNavigate={close} />
      </SheetContent>
    </Sheet>
  );
}
