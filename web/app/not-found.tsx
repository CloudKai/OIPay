import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Card className="max-w-md p-8 text-center">
        <p className="text-sm font-semibold text-[var(--primary)]">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          The link may be old, or you may not have access to that group.
        </p>
        <Button asChild className="mt-5">
          <Link href="/dashboard">Return to dashboard</Link>
        </Button>
      </Card>
    </main>
  );
}
