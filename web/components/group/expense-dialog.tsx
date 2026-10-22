"use client";

import type { ExpenseCategory, SplitType } from "@/generated/prisma/client";
import { Pencil, Plus } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { SubmissionKeys } from "@/lib/submission-key";
import { CurrencyAmountFields, useCurrencyAmount, type SavedConversion } from "@/components/group/currency-amount-fields";

import { useWorkspaceRuntime } from "@/components/group/workspace-runtime";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger
} from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { formatMoney, majorToMinor, minorToInput } from "@/lib/money";
import { calculateShares } from "@/lib/splits";
import type { SplitInput } from "@/lib/domain";

export type GroupMemberOption = {
  id: string;
  name: string;
  status: "ACTIVE" | "INVITED" | "REMOVED";
};

export type ExpenseEditorValue = SavedConversion & {
  id: string;
  version: number;
  description: string;
  totalMinor: number;
  paidByMemberId: string;
  splitType: SplitType;
  category: ExpenseCategory;
  expenseDate: string;
  notes: string | null;
  shares: {
    memberId: string;
    shareMinor: number;
    percentageBps: number | null;
    weight: number | null;
  }[];
};

const categories: { value: ExpenseCategory; label: string }[] = [
  { value: "GENERAL", label: "General" },
  { value: "FOOD", label: "Food & dining" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "HOUSING", label: "Housing" },
  { value: "ENTERTAINMENT", label: "Entertainment" },
  { value: "SHOPPING", label: "Shopping" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "HEALTH", label: "Health" },
  { value: "OTHER", label: "Other" }
];

const splitLabels: Record<SplitType, string> = {
  EQUAL: "Equally",
  EXACT: "Exact amounts",
  PERCENTAGE: "Percentages",
  SHARES: "Shares"
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ExpenseDialog({
  groupId,
  currency,
  members,
  expense
}: {
  groupId: string;
  currency: string;
  members: GroupMemberOption[];
  expense?: ExpenseEditorValue;
}) {
  const { actions: { createExpenseAction, updateExpenseAction } } = useWorkspaceRuntime();
  const availableMembers = members.filter(
    (member) => member.status !== "REMOVED" || expense?.shares.some((share) => share.memberId === member.id)
  );
  const submissionKeys = useRef(new SubmissionKeys());
  const submitting = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState(expense?.description ?? "");
  const amountInput = useCurrencyAmount(currency, expense?.totalMinor, expense);
  const [paidByMemberId, setPaidByMemberId] = useState(
    expense?.paidByMemberId ?? availableMembers[0]?.id ?? ""
  );
  const [splitType, setSplitType] = useState<SplitType>(
    expense?.splitType ?? "EQUAL"
  );
  const [category, setCategory] = useState<ExpenseCategory>(
    expense?.category ?? "GENERAL"
  );
  const [expenseDate, setExpenseDate] = useState(
    expense?.expenseDate ?? today()
  );
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      availableMembers.map((member) => [
        member.id,
        expense ? expense.shares.some((share) => share.memberId === member.id) : true
      ])
    )
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      expense?.shares.map((share) => [
        share.memberId,
        expense.splitType === "EXACT"
          ? minorToInput(share.shareMinor, currency)
          : expense.splitType === "PERCENTAGE"
            ? ((share.percentageBps ?? 0) / 100).toString()
            : expense.splitType === "SHARES"
              ? String(share.weight ?? 1)
              : ""
      ]) ?? []
    )
  );

  const totalMinor = amountInput.ledgerMinor;
  const participantIds = availableMembers
    .filter((member) => selected[member.id])
    .map((member) => member.id);
  const splitInputs = useMemo<SplitInput[]>(
    () =>
      participantIds.map((memberId) => ({
        memberId,
        ...(splitType === "EXACT"
          ? { amountMinor: majorToMinor(values[memberId] ?? "", currency) }
          : splitType === "PERCENTAGE"
            ? {
                percentageBps: Math.round(
                  Number(values[memberId] ?? "0") * 100
                )
              }
            : splitType === "SHARES"
              ? { weight: Number(values[memberId] ?? "0") }
              : {})
      })),
    [currency, participantIds, splitType, values]
  );

  const preview = useMemo(() => {
    if (!Number.isInteger(totalMinor) || totalMinor <= 0 || splitInputs.length === 0) {
      return null;
    }
    try {
      return calculateShares({ totalMinor, splitType, splits: splitInputs });
    } catch {
      return null;
    }
  }, [splitInputs, splitType, totalMinor]);

  const exactEntered = splitInputs.reduce(
    (sum, split) =>
      sum + (Number.isFinite(split.amountMinor) ? split.amountMinor ?? 0 : 0),
    0
  );
  const percentageEntered = splitInputs.reduce(
    (sum, split) => sum + (split.percentageBps ?? 0),
    0
  );

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !expense) {
      setSelected((current) =>
        Object.fromEntries(
          availableMembers.map((member) => [
            member.id,
            current[member.id] ?? true
          ])
        )
      );
      setPaidByMemberId((current) =>
        availableMembers.some((member) => member.id === current)
          ? current
          : availableMembers[0]?.id ?? ""
      );
      setError(null);
    }
    setOpen(nextOpen);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    if (amountInput.foreign && (!Number.isSafeInteger(totalMinor) || totalMinor <= 0)) {
      setError("Enter a valid foreign amount and exchange rate to calculate the group amount.");
      return;
    }
    if (!preview) {
      setError(
        splitType === "PERCENTAGE"
          ? "Percentages must total exactly 100%."
          : splitType === "EXACT"
            ? "Exact amounts must match the expense total."
            : "Check the amount and split values."
      );
      return;
    }

    const common = {
      groupId,
      expectedCurrency: currency,
      description,
      totalMinor,
      paidByMemberId,
      splitType,
      category,
      expenseDate,
      notes,
      conversion: amountInput.conversion,
      splits: splitInputs
    };
    submitting.current = true;
    startTransition(async () => {
      try {
        const result = expense
          ? await updateExpenseAction({
              ...common,
              expenseId: expense.id,
              expectedVersion: expense.version
            })
          : await createExpenseAction({
              ...common,
              idempotencyKey: submissionKeys.current.forPayload(common)
            });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        submissionKeys.current.clear();
        toast.success(result.message);
        setOpen(false);
      } catch {
        setError("We could not confirm the save. Retry with the same details to avoid a duplicate.");
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {expense ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${expense.description}`}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus className="h-4 w-4" />
            Add expense
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={expense ? "Edit expense" : "Add an expense"}
        description={`Choose who paid and how to split the expense. Shares are recorded in ${currency}.`}
        className="sm:max-w-3xl"
      >
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Description" htmlFor={`expense-description-${expense?.id ?? "new"}`}>
              <Input
                id={`expense-description-${expense?.id ?? "new"}`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Dinner"
                maxLength={140}
                required
              />
            </Field>
            <Field label="Paid by" htmlFor={`expense-payer-${expense?.id ?? "new"}`}>
              <Select
                id={`expense-payer-${expense?.id ?? "new"}`}
                value={paidByMemberId}
                onChange={(event) => setPaidByMemberId(event.target.value)}
              >
                {availableMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date" htmlFor={`expense-date-${expense?.id ?? "new"}`}>
              <Input
                id={`expense-date-${expense?.id ?? "new"}`}
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                required
              />
            </Field>
            <Field label="Category" htmlFor={`expense-category-${expense?.id ?? "new"}`}>
              <Select
                id={`expense-category-${expense?.id ?? "new"}`}
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ExpenseCategory)
                }
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Split method" htmlFor={`expense-split-${expense?.id ?? "new"}`}>
              <Select
                id={`expense-split-${expense?.id ?? "new"}`}
                value={splitType}
                onChange={(event) => setSplitType(event.target.value as SplitType)}
              >
                {Object.entries(splitLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <CurrencyAmountFields id={`expense-${expense?.id ?? "new"}`} groupId={groupId} groupCurrency={currency}
            value={amountInput} active={open} disabled={pending} />

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Participants and shares ({currency})</h3>
              {splitType === "EXACT" && Number.isFinite(totalMinor) ? (
                <p className={`text-xs font-semibold ${totalMinor - exactEntered === 0 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
                  {formatMoney(Math.abs(totalMinor - exactEntered), currency)}{" "}
                  {totalMinor - exactEntered >= 0 ? "remaining" : "over"}
                </p>
              ) : splitType === "PERCENTAGE" ? (
                <p className={`text-xs font-semibold ${percentageEntered === 10_000 ? "text-[var(--positive)]" : "text-[var(--negative)]"}`}>
                  {(Math.abs(10_000 - percentageEntered) / 100).toFixed(2)}%{" "}
                  {10_000 - percentageEntered >= 0 ? "remaining" : "over"}
                </p>
              ) : null}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {availableMembers.map((member) => {
                const checked = selected[member.id] ?? false;
                const share = preview?.find((item) => item.memberId === member.id);
                return (
                  <div
                    key={member.id}
                    className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--border)] bg-white px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [member.id]: event.target.checked
                        }))
                      }
                      className="h-4 w-4 accent-[var(--primary)]"
                      aria-label={`Include ${member.name}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {member.name}
                    </span>
                    {checked && splitType !== "EQUAL" ? (
                      <div className="relative w-24">
                        <Input
                          value={values[member.id] ?? ""}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [member.id]: event.target.value
                            }))
                          }
                          className="h-9 min-h-9 px-2 text-right text-xs"
                          inputMode="decimal"
                          aria-label={`${splitLabels[splitType]}${splitType === "EXACT" ? ` in ${currency}` : ""} for ${member.name}`}
                        />
                        {splitType === "PERCENTAGE" ? (
                          <span className="pointer-events-none absolute right-2 top-2 text-xs text-[var(--ink-subtle)]">%</span>
                        ) : null}
                      </div>
                    ) : null}
                    {checked && share ? (
                      <span className="w-20 text-right text-xs font-semibold text-[var(--primary)]">
                        {formatMoney(share.shareMinor, currency)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <Field label="Notes (optional)" htmlFor={`expense-notes-${expense?.id ?? "new"}`}>
            <Textarea
              id={`expense-notes-${expense?.id ?? "new"}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
              placeholder="Add useful context for the group"
            />
          </Field>
          <FormMessage message={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || amountInput.rateLoading}>
              {pending ? "Saving..." : expense ? "Save changes" : "Add expense"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
