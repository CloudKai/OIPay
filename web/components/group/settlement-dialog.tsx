"use client";

import type { PaymentMethod } from "@/generated/prisma/client";
import { Banknote, Pencil } from "lucide-react";
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
import type { SimplifiedDebt } from "@/lib/domain";
import { formatMoney, minorToInput } from "@/lib/money";
import type { GroupMemberOption } from "@/components/group/expense-dialog";

export type SettlementEditorValue = SavedConversion & {
  id: string;
  version: number;
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
  method: PaymentMethod;
  settledAt: string;
  notes: string | null;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function SettlementDialog({
  groupId,
  currency,
  members,
  debts,
  debt,
  settlement
}: {
  groupId: string;
  currency: string;
  members: GroupMemberOption[];
  debts: SimplifiedDebt[];
  debt?: SimplifiedDebt;
  settlement?: SettlementEditorValue;
}) {
  const defaultDebt = debt ?? debts[0];
  const { actions: { createSettlementAction, updateSettlementAction } } = useWorkspaceRuntime();
  const submissionKeys = useRef(new SubmissionKeys());
  const submitting = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [debtKey, setDebtKey] = useState(
    defaultDebt
      ? `${defaultDebt.fromMemberId}:${defaultDebt.toMemberId}`
      : ""
  );
  const [fromMemberId, setFromMemberId] = useState(
    settlement?.fromMemberId ?? defaultDebt?.fromMemberId ?? ""
  );
  const [toMemberId, setToMemberId] = useState(
    settlement?.toMemberId ?? defaultDebt?.toMemberId ?? ""
  );
  const amountInput = useCurrencyAmount(currency, settlement?.amountMinor ?? defaultDebt?.amountMinor, settlement);
  const [method, setMethod] = useState<PaymentMethod>(
    settlement?.method ?? "BANK_TRANSFER"
  );
  const [settledAt, setSettledAt] = useState(
    settlement?.settledAt ?? today()
  );
  const [notes, setNotes] = useState(settlement?.notes ?? "");

  const selectedDebt = useMemo(
    () =>
      debts.find(
        (item) => `${item.fromMemberId}:${item.toMemberId}` === debtKey
      ),
    [debtKey, debts]
  );

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const amountMinor = amountInput.ledgerMinor;
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      setError(amountInput.foreign
        ? "Enter a valid foreign amount and exchange rate to calculate the group payment."
        : "Enter a valid payment amount.");
      return;
    }
    setError(null);
    const common = {
      groupId,
      expectedCurrency: currency,
      fromMemberId,
      toMemberId,
      amountMinor,
      method,
      settledAt,
      notes,
      conversion: amountInput.conversion
    };
    submitting.current = true;
    startTransition(async () => {
      try {
        const result = settlement
          ? await updateSettlementAction({
              ...common,
              settlementId: settlement.id,
              expectedVersion: settlement.version
            })
          : await createSettlementAction({
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {settlement ? (
          <Button variant="ghost" size="sm">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        ) : (
          <Button variant={debt ? "primary" : "secondary"} size={debt ? "sm" : "default"}>
            <Banknote className="h-4 w-4" />
            {debt ? "Settle" : "Record payment"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        title={settlement ? "Edit payment" : "Record a payment"}
        description="Payments reduce the payer's current debt. Partial payments are supported."
        className="sm:max-w-xl"
      >
        <form onSubmit={submit} className="space-y-5">
          {!settlement ? (
            <Field label="Debt to settle" htmlFor="settlement-debt">
              <Select
                id="settlement-debt"
                value={debtKey}
                onChange={(event) => {
                  setDebtKey(event.target.value);
                  const next = debts.find(
                    (item) =>
                      `${item.fromMemberId}:${item.toMemberId}` ===
                      event.target.value
                  );
                  if (next) {
                    setFromMemberId(next.fromMemberId);
                    setToMemberId(next.toMemberId);
                    amountInput.setCurrency(currency);
                    amountInput.setAmount(minorToInput(next.amountMinor, currency));
                  }
                }}
              >
                {debts.length === 0 ? (
                  <option value="">Everyone is settled up</option>
                ) : null}
                {debts.map((item) => (
                  <option
                    key={`${item.fromMemberId}:${item.toMemberId}`}
                    value={`${item.fromMemberId}:${item.toMemberId}`}
                  >
                    {item.fromName} pays {item.toName} -{" "}
                    {formatMoney(item.amountMinor, currency)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Payer" htmlFor={`settlement-from-${settlement.id}`}>
                <Select
                  id={`settlement-from-${settlement.id}`}
                  value={fromMemberId}
                  onChange={(event) => setFromMemberId(event.target.value)}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Receiver" htmlFor={`settlement-to-${settlement.id}`}>
                <Select
                  id={`settlement-to-${settlement.id}`}
                  value={toMemberId}
                  onChange={(event) => setToMemberId(event.target.value)}
                >
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <CurrencyAmountFields id={`settlement-${settlement?.id ?? "new"}`} groupId={groupId} groupCurrency={currency}
            value={amountInput} active={open} disabled={pending}
            hint={!settlement && selectedDebt ? `Maximum current debt: ${formatMoney(selectedDebt.amountMinor, currency)}` : undefined} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Method" htmlFor={`settlement-method-${settlement?.id ?? "new"}`}>
              <Select
                id={`settlement-method-${settlement?.id ?? "new"}`}
                value={method}
                onChange={(event) =>
                  setMethod(event.target.value as PaymentMethod)
                }
              >
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CASH">Cash</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>
            <Field label="Date" htmlFor={`settlement-date-${settlement?.id ?? "new"}`}>
              <Input
                id={`settlement-date-${settlement?.id ?? "new"}`}
                type="date"
                value={settledAt}
                onChange={(event) => setSettledAt(event.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Notes (optional)" htmlFor={`settlement-notes-${settlement?.id ?? "new"}`}>
            <Textarea
              id={`settlement-notes-${settlement?.id ?? "new"}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
            />
          </Field>
          <FormMessage message={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || amountInput.rateLoading || (!settlement && debts.length === 0)}
            >
              {pending ? "Saving..." : settlement ? "Save changes" : "Record payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
