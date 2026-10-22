"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createGroupAction } from "@/app/actions/groups";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger
} from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { supportedCurrencies } from "@/lib/money";

const regionCurrencies: Record<string, string> = {
  US: "USD",
  SG: "SGD",
  GB: "GBP",
  AU: "AUD",
  CA: "CAD",
  JP: "JPY",
  CN: "CNY",
  HK: "HKD",
  IN: "INR",
  MY: "MYR",
  TH: "THB",
  PH: "PHP",
  KR: "KRW",
  NZ: "NZD"
};

export default function CreateGroupForm({
  triggerLabel = "New group"
}: {
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createGroupAction({ name, currency });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      setName("");
      router.push(`/groups/${result.data.groupId}`);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen && !currencyTouched) {
          const region = new Intl.Locale(navigator.language).region;
          if (region && regionCurrencies[region]) {
            setCurrency(regionCurrencies[region]);
          }
        }
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Create a group"
        description="Choose the currency for the group’s accounts. Foreign purchases can be converted when you add them."
        className="sm:max-w-lg"
      >
        <form onSubmit={onSubmit} className="space-y-5">
          <Field label="Group name" htmlFor="group-name">
            <Input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Weekend in Penang"
              minLength={2}
              maxLength={80}
              autoFocus
              required
            />
          </Field>
          <Field
            label="Currency"
            htmlFor="group-currency"
            hint="Balances use this currency. It becomes fixed after the first expense or repayment."
          >
            <Select
              id="group-currency"
              value={currency}
              onChange={(event) => {
                setCurrencyTouched(true);
                setCurrency(event.target.value);
              }}
            >
              {supportedCurrencies.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} - {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <FormMessage message={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create group"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
