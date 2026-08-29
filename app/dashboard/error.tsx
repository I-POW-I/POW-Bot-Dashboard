'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// This catches any uncaught render error anywhere under /dashboard/* and
// shows a real fallback instead of Next.js's default: a blank white screen
// with nothing on it. Previously there was NO error.tsx anywhere in this
// route tree at all, so any unhandled error during a page transition (e.g.
// clicking browser Back mid-navigation) had nothing to fall back to.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('[dashboard] uncaught error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          This page hit an error. You can try again, or head back to your
          server list.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Back to servers
        </Button>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}
