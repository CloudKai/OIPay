// Keep keys for attempted payloads until a save is acknowledged. Returning to
// an earlier payload after a failed response must also reuse its original key.
export class SubmissionKeys {
  private readonly keys = new Map<string, string>();

  forPayload(payload: unknown): string {
    const fingerprint = JSON.stringify(payload);
    const existing = this.keys.get(fingerprint);
    if (existing) return existing;
    const key = crypto.randomUUID();
    this.keys.set(fingerprint, key);
    return key;
  }

  clear(): void {
    this.keys.clear();
  }
}
