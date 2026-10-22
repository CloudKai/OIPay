import "server-only";

import { conversionToRecord, type CurrencyConversion } from "@/lib/currency";
import { ActionFailure } from "@/lib/server/authz";

interface SavedConversion {
  originalCurrency: string | null;
  originalMinor: number | null;
  exchangeRate: string | null;
  exchangeRateDate: Date | null;
  exchangeRateSource: string | null;
}

export function financialConversionRecord(
  conversion: CurrencyConversion | null | undefined,
  groupCurrency: string,
  ledgerMinor: number,
  current?: SavedConversion
) {
  // An older client editing a description must not erase or refresh its saved rate.
  if (conversion === undefined && current?.originalCurrency) {
    conversion = {
      currency: current.originalCurrency,
      originalMinor: current.originalMinor!,
      rate: current.exchangeRate!,
      rateDate: current.exchangeRateDate!.toISOString().slice(0, 10),
      source: current.exchangeRateSource as CurrencyConversion["source"]
    };
  }
  try {
    return conversionToRecord(conversion, groupCurrency, ledgerMinor);
  } catch (error) {
    throw new ActionFailure(error instanceof Error ? error.message : "Check the currency conversion.");
  }
}
