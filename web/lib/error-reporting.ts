type ErrorWithCode = Error & { code?: unknown };

export type ErrorLogRecord = {
  name: string;
  message: string;
  code?: string;
};

const DATABASE_CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "P1001",
  "P1002"
]);

export function errorLogRecords(error: unknown): ErrorLogRecord[] {
  const queue: unknown[] = [error];
  const records: ErrorLogRecord[] = [];

  while (queue.length > 0 && records.length < 10) {
    const current = queue.shift();
    if (current instanceof AggregateError) {
      records.push({
        name: current.name,
        message: current.message || "Multiple operations failed"
      });
      queue.push(...current.errors);
      continue;
    }

    if (current instanceof Error) {
      const code = (current as ErrorWithCode).code;
      records.push({
        name: current.name,
        message: current.message || "An operation failed",
        ...(typeof code === "string" ? { code } : {})
      });
      if (current.cause) queue.push(current.cause);
      continue;
    }

    records.push({
      name: "UnknownError",
      message: typeof current === "string" ? current : String(current)
    });
  }

  return records;
}

export function isDatabaseConnectionError(error: unknown): boolean {
  return errorLogRecords(error).some(({ code, message }) => {
    if (code && DATABASE_CONNECTION_CODES.has(code)) return true;
    const normalized = message.toLowerCase();
    return (
      normalized.includes("connection refused") ||
      normalized.includes("connection terminated") ||
      normalized.includes("can't reach database") ||
      normalized.includes("could not connect")
    );
  });
}
