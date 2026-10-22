"use client";

import { useEffect, useRef, useState } from "react";

import { useWorkspaceRuntime } from "@/components/group/workspace-runtime";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { convertMinor } from "@/lib/currency";
import { formatMoney, majorToMinor, minorToInput, supportedCurrencies } from "@/lib/money";

export type SavedConversion = {
  originalCurrency?: string | null;
  originalMinor?: number | null;
  exchangeRate?: string | null;
  exchangeRateDate?: string | null;
  exchangeRateSource?: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function useCurrencyAmount(groupCurrency: string, initialMinor?: number, saved?: SavedConversion) {
  const hasSaved = Boolean(saved?.originalCurrency && saved.originalMinor != null && saved.exchangeRate);
  const [amount, setAmount] = useState(() => hasSaved
    ? minorToInput(saved!.originalMinor!, saved!.originalCurrency!)
    : initialMinor == null ? "" : minorToInput(initialMinor, groupCurrency));
  const [currency, setCurrencyState] = useState(hasSaved ? saved!.originalCurrency! : groupCurrency);
  const [rate, setRate] = useState(hasSaved ? saved!.exchangeRate! : "");
  const [rateDate, setRateDate] = useState(hasSaved ? saved!.exchangeRateDate ?? today() : today());
  const [source, setSource] = useState(hasSaved ? saved!.exchangeRateSource ?? "Manual" : "Manual");
  const [rateLoading, setRateLoading] = useState(false);
  const foreign = currency !== groupCurrency;
  const originalMinor = majorToMinor(amount, currency);
  let ledgerMinor = originalMinor;
  if (foreign) {
    try {
      ledgerMinor = convertMinor(originalMinor, currency, groupCurrency, rate);
    } catch {
      ledgerMinor = Number.NaN;
    }
  }

  return {
    amount, setAmount, currency, foreign, rate, rateDate, source, ledgerMinor, rateLoading, setRateLoading,
    setCurrency(next: string) {
      setCurrencyState(next);
      setRate("");
      setSource("Manual");
      setRateDate(today());
    },
    setManualRate(value: string) {
      setRate(value);
      setSource("Manual");
      setRateDate(today());
    },
    setSuggestedRate(value: { rate: string; rateDate: string; source: string }) {
      setRate(value.rate);
      setRateDate(value.rateDate);
      setSource(value.source);
    },
    conversion: foreign ? { currency, originalMinor, rate, rateDate, source } : undefined
  };
}

export function CurrencyAmountFields({
  id,
  groupId,
  groupCurrency,
  value,
  active,
  disabled,
  hint
}: {
  id: string;
  groupId: string;
  groupCurrency: string;
  value: ReturnType<typeof useCurrencyAmount>;
  active: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const { isDemo, getQuote } = useWorkspaceRuntime();
  const loading = value.rateLoading;
  const setLoading = value.setRateLoading;
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const requestedRefresh = useRef(0);
  const currentValue = useRef(value);
  useEffect(() => {
    currentValue.current = value;
  });

  useEffect(() => {
    if (!active || !value.foreign || (currentValue.current.rate && refresh === requestedRefresh.current)) return;
    requestedRefresh.current = refresh;
    const controller = new AbortController();
    setLoading(true);
    setLookupError(null);
    getQuote({ groupId, from: value.currency, to: groupCurrency, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) currentValue.current.setSuggestedRate(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLookupError("We couldn’t load today’s rate. Enter a rate below, or try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      setLoading(false);
    };
  }, [active, groupId, groupCurrency, value.currency, value.foreign, refresh, setLoading, getQuote]);

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={`Amount (${value.currency})`} htmlFor={`${id}-amount`} hint={hint}>
          <Input id={`${id}-amount`} value={value.amount} onChange={(event) => value.setAmount(event.target.value)}
            placeholder={minorToInput(0, value.currency)} inputMode="decimal" required disabled={disabled} />
        </Field>
        <Field label="Currency" htmlFor={`${id}-currency`} hint={`Group accounts use ${groupCurrency}.`}>
          <Select id={`${id}-currency`} value={value.currency} onChange={(event) => value.setCurrency(event.target.value)} disabled={disabled}>
            {supportedCurrencies.map((item) => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}
          </Select>
        </Field>
      </div>
      {value.foreign ? (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Convert to {groupCurrency}</p>
            <Button type="button" variant="ghost" size="sm" disabled={loading || disabled} onClick={() => setRefresh((current) => current + 1)}>
              {loading ? "Loading rate…" : isDemo ? "Use sample rate" : "Use today’s rate"}
            </Button>
          </div>
          <Field label={`Exchange rate: 1 ${value.currency} in ${groupCurrency}`} htmlFor={`${id}-rate`}>
            <Input id={`${id}-rate`} value={value.rate} onChange={(event) => value.setManualRate(event.target.value)}
              inputMode="decimal" required disabled={loading || disabled} aria-describedby={`${id}-rate-help`} />
          </Field>
          <div id={`${id}-rate-help`} className="space-y-1 text-xs text-[var(--ink-muted)]" aria-live="polite" aria-busy={loading}>
            {lookupError ? <p role="alert" className="font-medium text-[var(--negative)]">{lookupError}</p> : null}
            {value.rate ? <p>{isDemo ? "Demo rate" : value.source} · {value.rateDate}. This rate is saved with the record.</p> : null}
            <p>{isDemo ? "Demo rates are illustrative, not live. You can enter a different rate to try a conversion." : "Daily reference rates may use the latest business day. Enter your bank’s rate here if it differs."}</p>
          </div>
          <p className="text-sm font-semibold tabular-nums" aria-live="polite">
            {Number.isSafeInteger(value.ledgerMinor) && value.ledgerMinor > 0
              ? `Group amount: ${formatMoney(value.ledgerMinor, groupCurrency)}`
              : "Enter an amount and a valid rate to see the group amount."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
