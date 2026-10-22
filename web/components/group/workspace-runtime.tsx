"use client";

import { createContext, useContext } from "react";

import { createExpenseAction, updateExpenseAction, deleteExpenseAction } from "@/app/actions/expenses";
import { createSettlementAction, updateSettlementAction, deleteSettlementAction } from "@/app/actions/settlements";

export type WorkspaceActions = {
  createExpenseAction: typeof createExpenseAction;
  updateExpenseAction: typeof updateExpenseAction;
  deleteExpenseAction: typeof deleteExpenseAction;
  createSettlementAction: typeof createSettlementAction;
  updateSettlementAction: typeof updateSettlementAction;
  deleteSettlementAction: typeof deleteSettlementAction;
};

export type CurrencyQuote = {
  from: string;
  to: string;
  rate: string;
  rateDate: string;
  source: string;
};

type QuoteInput = { groupId: string; from: string; to: string; signal: AbortSignal };

const liveRuntime = {
  isDemo: false,
  actions: { createExpenseAction, updateExpenseAction, deleteExpenseAction,
    createSettlementAction, updateSettlementAction, deleteSettlementAction },
  async getQuote({ groupId, from, to, signal }: QuoteInput): Promise<CurrencyQuote> {
    const query = new URLSearchParams({ groupId, from, to });
    const response = await fetch(`/api/exchange-rate?${query}`, { signal });
    const quote = await response.json();
    if (!response.ok || quote.from !== from || quote.to !== to ||
      typeof quote.rate !== "string" || typeof quote.rateDate !== "string" || typeof quote.source !== "string") {
      throw new Error("Rate unavailable");
    }
    return quote;
  }
};

const WorkspaceRuntime = createContext(liveRuntime);

// The demo supplies local actions. Real groups keep authenticated server actions.
export const WorkspaceRuntimeProvider = WorkspaceRuntime.Provider;
export function useWorkspaceRuntime() { return useContext(WorkspaceRuntime); }
