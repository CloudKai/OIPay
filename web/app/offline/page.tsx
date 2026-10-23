import { WifiOff } from "lucide-react";

import { Card } from "@/components/ui/card";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <Card className="max-w-md p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface-muted)]">
          <WifiOff className="h-6 w-6 text-[var(--primary)]" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold">You are offline</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
          Reconnect to view balances or change financial records. OIPay
          never caches private group data or queues money changes offline.
        </p>
      </Card>
    </main>
  );
}
