import { Bot } from 'lucide-react';

// Next.js shows this automatically during route transitions under
// /dashboard/* instead of a blank gap while the next page's data loads.
export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Bot className="h-5 w-5 animate-pulse text-primary" />
        <span>Loading…</span>
      </div>
    </div>
  );
}
