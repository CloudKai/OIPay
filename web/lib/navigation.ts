export function safeRedirectPath(
  value: string | null | undefined,
  origin: string,
  fallback = "/dashboard"
): string {
  const localPath = safeLocalRedirectPath(value);
  if (localPath) return localPath;
  if (!value) return fallback;

  try {
    const url = new URL(value);
    if (url.origin === origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return fallback;
  }

  return fallback;
}

export function safeLocalRedirectPath(
  value: string | null | undefined
): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  return value;
}
