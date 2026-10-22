"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedName = name.trim();
    if (normalizedName.length < 2) {
      setError("Group name must be at least 2 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: normalizedName })
      });

      const payload = (await response.json().catch(() => null)) as
        | { group?: { id: string }; error?: string }
        | null;

      setLoading(false);

      if (!response.ok || !payload?.group) {
        if (response.status === 401) {
          setError("Your session expired. Please sign in again.");
          return;
        }

        setError(payload?.error ?? "Failed to create group.");
        return;
      }

      setName("");
      router.push(`/groups/${payload.group.id}`);
      router.refresh();
    } catch {
      setLoading(false);
      setError("Network error. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="mb-1 block text-sm font-medium text-slate-700">Create a new room</label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          placeholder="Thailand Food Trip"
          required
          minLength={2}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Creating..." : "Create room"}
      </button>

      {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
    </form>
  );
}
