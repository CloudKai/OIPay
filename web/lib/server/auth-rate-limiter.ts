import "server-only";

import { createHmac } from "node:crypto";

import { prisma } from "@/lib/prisma";

interface LoginIdentity {
  email: string;
  ipAddress: string;
}

interface RateLimitBucket {
  bucket: string;
  maxFailures: number;
  windowMs: number;
  blockMs: number;
}

const minute = 60_000;
const defaultWindowMs = 15 * minute;
const cleanupAfterMs = 24 * 60 * minute;

export class AuthRateLimitExceeded extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many sign-in attempts.");
  }
}

function rateLimitSecret(): string {
  return (
    process.env.AUTH_RATE_LIMIT_SECRET ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.DATABASE_URL ??
    "splittogether-development-rate-limit-secret"
  );
}

export function hashAuthIdentifier(value: string): string {
  return createHmac("sha256", rateLimitSecret()).update(value).digest("hex");
}

export function loginRateLimitBuckets(input: LoginIdentity): RateLimitBucket[] {
  const email = input.email.trim().toLowerCase();
  const ipAddress = input.ipAddress.trim() || "unknown";

  return [
    {
      bucket: `login:identity:${hashAuthIdentifier(`${ipAddress}:${email}`)}`,
      maxFailures: 5,
      windowMs: defaultWindowMs,
      blockMs: 15 * minute
    },
    {
      bucket: `login:email:${hashAuthIdentifier(email)}`,
      maxFailures: 10,
      windowMs: defaultWindowMs,
      blockMs: 30 * minute
    },
    {
      bucket: `login:ip:${hashAuthIdentifier(ipAddress)}`,
      maxFailures: 30,
      windowMs: defaultWindowMs,
      blockMs: 15 * minute
    }
  ];
}

export class AuthRateLimiter {
  async assertAllowed(input: LoginIdentity): Promise<void> {
    const now = new Date();
    const buckets = loginRateLimitBuckets(input);
    const policiesByBucket = new Map(
      buckets.map((bucket) => [bucket.bucket, bucket])
    );

    const records = await prisma.authRateLimit.findMany({
      where: { bucket: { in: buckets.map((bucket) => bucket.bucket) } }
    });

    for (const record of records) {
      if (record.blockedUntil && record.blockedUntil > now) {
        throw new AuthRateLimitExceeded(
          Math.ceil((record.blockedUntil.getTime() - now.getTime()) / 1000)
        );
      }

      const policy = policiesByBucket.get(record.bucket);
      if (
        policy &&
        record.failedCount >= policy.maxFailures &&
        record.firstFailedAt.getTime() > now.getTime() - policy.windowMs
      ) {
        throw new AuthRateLimitExceeded(Math.ceil(policy.blockMs / 1000));
      }
    }
  }

  async recordFailure(input: LoginIdentity): Promise<void> {
    const now = new Date();
    const buckets = loginRateLimitBuckets(input);
    const cleanupBefore = new Date(now.getTime() - cleanupAfterMs);

    await prisma.$transaction(async (tx) => {
      for (const policy of buckets) {
        const existing = await tx.authRateLimit.findUnique({
          where: { bucket: policy.bucket }
        });
        const windowExpired =
          !existing ||
          existing.firstFailedAt.getTime() <= now.getTime() - policy.windowMs ||
          Boolean(existing.blockedUntil && existing.blockedUntil <= now);
        const failedCount = windowExpired ? 1 : existing.failedCount + 1;
        const blockedUntil =
          failedCount >= policy.maxFailures
            ? new Date(now.getTime() + policy.blockMs)
            : null;

        await tx.authRateLimit.upsert({
          where: { bucket: policy.bucket },
          create: {
            bucket: policy.bucket,
            failedCount,
            firstFailedAt: now,
            lastFailedAt: now,
            blockedUntil
          },
          update: {
            failedCount,
            firstFailedAt: windowExpired ? now : existing?.firstFailedAt ?? now,
            lastFailedAt: now,
            blockedUntil
          }
        });
      }

      await tx.authRateLimit.deleteMany({
        where: {
          updatedAt: { lt: cleanupBefore },
          blockedUntil: null
        }
      });
    });
  }

  async recordSuccess(input: LoginIdentity): Promise<void> {
    const buckets = loginRateLimitBuckets(input);
    await prisma.authRateLimit.deleteMany({
      where: { bucket: { in: buckets.slice(0, 2).map((bucket) => bucket.bucket) } }
    });
  }
}
