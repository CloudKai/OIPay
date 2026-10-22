import "server-only";

import { Prisma } from "@/generated/prisma/client";

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// Retry the whole transaction so balance checks use a fresh database snapshot.
export async function retryTransaction<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!hasPrismaCode(error, "P2034") || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}

export async function createOnce<T>(
  findExisting: () => Promise<T | null>,
  create: () => Promise<T>
): Promise<T> {
  return retryTransaction(async () => {
    const existing = await findExisting();
    if (existing) return existing;
    try {
      return await create();
    } catch (error) {
      // A concurrent request can commit before our write OR balance check.
      // Read after rollback: its payment may already have reduced the debt.
      const winner = await findExisting();
      if (winner) return winner;
      throw error;
    }
  });
}
