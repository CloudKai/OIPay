// Group names remain distinct even when account profiles have the same name.
export function memberNameKey(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

export function principalMembershipWhere(principalId: string) {
  return principalId.startsWith("guest:")
    ? { guestSessionId: principalId.slice(6), userId: null }
    : { userId: principalId };
}
