"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";

import { useWorkspaceRuntime, type CurrencyQuote } from "@/components/group/workspace-runtime";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/form";
import { convertMinor } from "@/lib/currency";
import { formatMoney, isSupportedCurrency, supportedCurrencies } from "@/lib/money";

type Quote = CurrencyQuote;

type DisplayContext = {
  currency: string;
  groupCurrency: string;
  quote: Quote | null;
  error: string | null;
  select: (currency: string) => void;
  retry: () => void;
};

const CurrencyContext = createContext<DisplayContext | null>(null);
const preferenceEvent = "splittogether:display-currency";

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(preferenceEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(preferenceEvent, listener);
  };
}

export function DisplayCurrencyProvider({
  groupId, memberId, groupCurrency, children
}: {
  groupId: string;
  memberId: string;
  groupCurrency: string;
  children: React.ReactNode;
}) {
  const { isDemo, getQuote } = useWorkspaceRuntime();
  const key = `splittogether:currency:${groupId}:${memberId}`;
  const [temporaryCurrency, setTemporaryCurrency] = useState<string | null>(null);
  const snapshot = useCallback(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored && isSupportedCurrency(stored) ? stored : groupCurrency;
    } catch {
      return groupCurrency;
    }
  }, [groupCurrency, key]);
  const preference = useSyncExternalStore(subscribe, snapshot, () => groupCurrency);
  const currency = temporaryCurrency ?? preference;
  const [result, setResult] = useState<{ currency: string; quote?: Quote; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (currency === groupCurrency) return;
    const controller = new AbortController();
    getQuote({ groupId, from: groupCurrency, to: currency, signal: controller.signal })
      .then((quote) => {
        // Validate with the same exact arithmetic used for financial records.
        convertMinor(100, groupCurrency, currency, quote.rate);
        if (!controller.signal.aborted) setResult({ currency, quote: isDemo ? { ...quote, source: "Sample demo rate" } : quote });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ currency, error: "Conversion is unavailable. Your group balances are still shown below." });
      });
    return () => controller.abort();
  }, [attempt, currency, groupCurrency, groupId, getQuote, isDemo]);

  const quote = currency !== groupCurrency && result?.currency === currency ? result.quote ?? null : null;
  const error = currency !== groupCurrency && result?.currency === currency ? result.error ?? null : null;
  return (
    <CurrencyContext.Provider value={{
      currency, groupCurrency, quote, error,
      select(next) {
        setTemporaryCurrency(next);
        setResult(null);
        try {
          window.localStorage.setItem(key, next);
          window.dispatchEvent(new Event(preferenceEvent));
        } catch {
          // This visit still supports conversion when browser storage is unavailable.
        }
      },
      retry() { setResult(null); setAttempt((value) => value + 1); }
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function DisplayCurrencyPicker() {
  const context = useContext(CurrencyContext);
  if (!context) return null;
  const { currency, groupCurrency, quote, error } = context;
  return (
    <section className="flex flex-col gap-3 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between" aria-label="Personal currency display">
      <Field label="Also show balances in" htmlFor="display-currency" className="sm:w-64">
        <Select id="display-currency" value={currency} onChange={(event) => context.select(event.target.value)}>
          <option value={groupCurrency}>{groupCurrency} — group currency only</option>
          {supportedCurrencies.filter((item) => item.code !== groupCurrency).map((item) => (
            <option key={item.code} value={item.code}>{item.code} — {item.name}</option>
          ))}
        </Select>
      </Field>
      <div className="max-w-prose text-sm text-[var(--ink-muted)]" aria-live="polite">
        {currency === groupCurrency ? (
          <p>Accounts and repayments use {groupCurrency}. Your display choice is saved on this browser.</p>
        ) : error ? (
          <div className="flex flex-wrap items-center gap-2">
            <p role="status">{error}</p>
            <Button variant="secondary" size="sm" onClick={context.retry}>Retry conversion</Button>
          </div>
        ) : quote ? (
          <p>Estimates at 1 {groupCurrency} = {quote.rate} {currency} · {quote.source}, {quote.rateDate}. Amounts owed remain in {groupCurrency}.</p>
        ) : <p role="status">Loading {currency} equivalents…</p>}
      </div>
    </section>
  );
}

export function DisplayEquivalent({ amountMinor, className = "text-xs font-normal text-[var(--ink-muted)]" }: {
  amountMinor: number;
  className?: string;
}) {
  const context = useContext(CurrencyContext);
  if (!context?.quote) return null;
  let converted: number;
  try {
    converted = convertMinor(amountMinor, context.groupCurrency, context.currency, context.quote.rate);
  } catch {
    return null;
  }
  return <span className={`block tabular-nums ${className}`}>≈ {formatMoney(converted, context.currency)}</span>;
}
