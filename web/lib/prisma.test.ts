import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adapter: vi.fn(),
  client: vi.fn(),
  query: vi.fn().mockResolvedValue([{ result: 1 }])
}));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class { constructor() { mocks.adapter(); } }
}));
vi.mock("@/generated/prisma/client", () => ({
  PrismaClient: class {
    constructor() { mocks.client(); }
    $queryRaw = mocks.query;
  }
}));

afterEach(() => {
  delete (globalThis as { prisma?: unknown }).prisma;
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

it("reuses one connection pool across repeated production queries", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://unused:test@localhost/test");
  const { prisma, getPrisma } = await import("./prisma");
  await Promise.all(Array.from({ length: 25 }, () => prisma.$queryRaw`SELECT 1`));
  expect(getPrisma()).toBe(getPrisma());
  expect(mocks.adapter).toHaveBeenCalledTimes(1);
  expect(mocks.client).toHaveBeenCalledTimes(1);
  expect(mocks.query).toHaveBeenCalledTimes(25);
});
