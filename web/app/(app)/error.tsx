"use client";

import { CircleAlert } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error", { digest: error.digest });
  }, [error]);

  return (
    <Card className="mx-auto max-w-xl p-8 text-center">
      <CircleAlert className="mx-auto h-8 w-8 text-red-700" />
      <h1 className="mt-4 text-2xl font-semibold">This page could not load</h1>
      <p className="mt-2 text-sm text-[var(--ink-muted)]">
        Your financial data was not changed. Try loading the page again.
      </p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </Card>
  );
}
