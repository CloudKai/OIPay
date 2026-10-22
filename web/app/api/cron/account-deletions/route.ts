import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { processAccountDeletion } from "@/lib/server/account-deletion";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || secret.length < 32 || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const jobs = await prisma.accountDeletionJob.findMany({
    where: { completedAt: null, nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: 5,
    select: { authUserId: true }
  });
  const results = await Promise.allSettled(jobs.map((job) => processAccountDeletion(job.authUserId)));
  const completed = results.filter((result) => result.status === "fulfilled" && result.value).length;
  return NextResponse.json(
    { attempted: jobs.length, completed, pending: jobs.length - completed },
    { status: completed === jobs.length ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
