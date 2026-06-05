import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeToggle } from './ThemeToggle';
import { ThemeInit } from './ThemeInit';
import { Toaster } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TooltipProvider } from '@/components/ui/tooltip';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <ThemeInit />
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 max-w-[85vw] p-0 border-sidebar-border bg-sidebar text-sidebar-foreground">
            <Sidebar mobile onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <header className="flex h-14 items-center gap-3 bg-background/80 backdrop-blur-xl px-4 md:px-6 border-b border-border/40">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Breadcrumbs />
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 bg-background">
            <Outlet />
          </main>
        </div>
        <Toaster position="top-right" richColors />
      </div>
    </TooltipProvider>
  );
}
