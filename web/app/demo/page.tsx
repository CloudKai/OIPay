import { Suspense } from "react";
import type { Metadata } from "next";

import DemoWorkspace from "@/components/demo/demo-workspace";
import { createDemoState } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Try the demo", robots: { index: false, follow: false } };

export default function DemoPage() {
  return (
    <Suspense fallback={<p className="p-6" role="status">Opening your demo group…</p>}>
      <DemoWorkspace initialState={createDemoState()} />
    </Suspense>
  );
}
