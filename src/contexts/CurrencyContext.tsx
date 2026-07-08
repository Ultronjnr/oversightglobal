import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_CURRENCY,
  formatCurrency as formatCurrencyBase,
  currencySymbol,
  type CurrencyCode,
} from "@/lib/utils";

interface CurrencyContextType {
  /** The organization's chosen currency code (defaults to ZAR). */
  currency: CurrencyCode;
  /** The symbol for the organization currency, e.g. "R". */
  symbol: string;
  /** Format an amount using the organization currency. */
  format: (amount: number, decimals?: number) => string;
  isLoading: boolean;
  refreshCurrency: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) {
      setCurrency(DEFAULT_CURRENCY);
      return;
    }
    setIsLoading(true);
    const { data } = await supabase
      .from("organizations")
      .select("currency")
      .eq("id", orgId)
      .single();
    const cur = (data?.currency as CurrencyCode) || DEFAULT_CURRENCY;
    setCurrency(cur);
    setIsLoading(false);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const format = useCallback(
    (amount: number, decimals: number = 2) =>
      formatCurrencyBase(amount, currency, decimals),
    [currency]
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        symbol: currencySymbol(currency),
        format,
        isLoading,
        refreshCurrency: load,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
