'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Root-level fallback — catches anything that slips past every other
// boundary (including on the landing page itself). Same reasoning as
// app/dashboard/error.tsx: no error boundary anywhere means any uncaught
// error is a blank white screen with no way to recover except a hard
// browser refresh.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[root] uncaught error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="max-w-sm text-sm text-muted-foreground">
              The app hit an unexpected error.
            </p>
          </div>
          <Button onClick={() => reset()}>Try again</Button>
        </div>
      </body>
    </html>
  );
}
