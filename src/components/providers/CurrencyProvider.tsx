"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CURRENCY_COOKIE_NAME,
  CURRENCY_STORAGE_KEY,
  FALLBACK_BASE_CURRENCY,
  convertAmountFromBase,
  convertDisplayToBase,
  extractCountryFromAcceptLanguage,
  formatPrice as formatPriceHelper,
  mapCountryToCurrencyCode,
  type FormatPriceOptions,
  type PublicCurrencyDTO,
} from "@/lib/currency";
import { formatMoney, type MoneyInput } from "@/lib/money";
import { setPreferredCurrencyAction } from "@/modules/currencies/currency.actions";

export interface CurrencyContextValue {
  currencies: PublicCurrencyDTO[];
  baseCurrency: PublicCurrencyDTO;
  defaultCurrency: PublicCurrencyDTO;
  currency: PublicCurrencyDTO;
  isBaseCurrency: boolean;
  setCurrency: (code: string) => void;
  formatPrice: (amount: MoneyInput, options?: FormatPriceOptions) => string;
  convertFromBase: (amount: MoneyInput) => string;
  convertToBase: (displayAmount: MoneyInput) => string;
}

const CurrencyContext = React.createContext<CurrencyContextValue | null>(null);

function readClientCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function writeClientCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function readClientStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeClientStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or private browsing errors cleanly
  }
}

type DetectionSource = "user" | "preference" | "geo" | "accept_language" | "default";

interface CurrencyInternalContext extends CurrencyContextValue {
  applyServerDetection: (code: string, source: DetectionSource) => void;
}

const InternalCurrencyContext = React.createContext<CurrencyInternalContext | null>(null);

interface CurrencyProviderProps {
  currencies: PublicCurrencyDTO[];
  defaultCurrencyCode?: string;
  baseCurrencyCode?: string;
  initialCurrencyCode?: string;
  children: React.ReactNode;
}

export function CurrencyProvider({
  currencies,
  defaultCurrencyCode,
  baseCurrencyCode,
  initialCurrencyCode,
  children,
}: CurrencyProviderProps) {
  const router = useRouter();
  const safeList = React.useMemo(
    () => (currencies.length > 0 ? currencies : [FALLBACK_BASE_CURRENCY]),
    [currencies],
  );

  const byCode = React.useMemo(
    () => new Map(safeList.map((c) => [c.code.toUpperCase(), c])),
    [safeList],
  );

  const baseCurrency = React.useMemo(() => {
    if (baseCurrencyCode && byCode.has(baseCurrencyCode.toUpperCase())) {
      return byCode.get(baseCurrencyCode.toUpperCase())!;
    }
    return safeList.find((c) => c.isBase) ?? safeList[0] ?? FALLBACK_BASE_CURRENCY;
  }, [baseCurrencyCode, byCode, safeList]);

  const defaultCurrency = React.useMemo(() => {
    if (defaultCurrencyCode && byCode.has(defaultCurrencyCode.toUpperCase())) {
      return byCode.get(defaultCurrencyCode.toUpperCase())!;
    }
    return (
      safeList.find((c) => c.isDefault) ?? baseCurrency ?? safeList[0] ?? FALLBACK_BASE_CURRENCY
    );
  }, [baseCurrency, byCode, defaultCurrencyCode, safeList]);

  const initialResolvedCode = React.useMemo(() => {
    if (initialCurrencyCode && byCode.has(initialCurrencyCode.toUpperCase())) {
      return initialCurrencyCode.toUpperCase();
    }
    return defaultCurrency.code;
  }, [byCode, defaultCurrency.code, initialCurrencyCode]);

  const [selectedCode, setSelectedCode] = React.useState<string>(initialResolvedCode);
  const explicitSelectionRef = React.useRef<boolean>(false);

  // Sync cookie/localStorage immediately before browser paint so there is zero hydration mismatch
  // and zero flash of the wrong currency on static/cached shells.
  React.useLayoutEffect(() => {
    if (explicitSelectionRef.current) return;
    const cookieVal = readClientCookie(CURRENCY_COOKIE_NAME);
    const storageVal = readClientStorage(CURRENCY_STORAGE_KEY);
    const candidate = cookieVal ?? storageVal;
    const matched = candidate ? byCode.get(candidate.trim().toUpperCase()) : undefined;
    if (matched) {
      explicitSelectionRef.current = true;
      if (!cookieVal) writeClientCookie(CURRENCY_COOKIE_NAME, matched.code);
      if (!storageVal) writeClientStorage(CURRENCY_STORAGE_KEY, matched.code);
      queueMicrotask(() => setSelectedCode(matched.code));
      return;
    }

    if (typeof navigator !== "undefined") {
      const langCountry = extractCountryFromAcceptLanguage(
        navigator.languages?.join(",") || navigator.language,
      );
      const mapped = mapCountryToCurrencyCode(langCountry);
      if (mapped && byCode.has(mapped)) {
        queueMicrotask(() => setSelectedCode(mapped));
      }
    }
  }, [byCode]);

  const activeCurrency = React.useMemo(() => {
    return byCode.get(selectedCode.toUpperCase()) ?? defaultCurrency;
  }, [byCode, defaultCurrency, selectedCode]);

  const applyServerDetection = React.useCallback(
    (code: string, source: DetectionSource) => {
      const matched = byCode.get(code.trim().toUpperCase());
      if (!matched) return;

      // Signed-in user account preference always synchronizes cookie/storage; explicit cookie takes precedence over geo.
      if (source === "user") {
        explicitSelectionRef.current = true;
        setSelectedCode(matched.code);
        writeClientCookie(CURRENCY_COOKIE_NAME, matched.code);
        writeClientStorage(CURRENCY_STORAGE_KEY, matched.code);
        return;
      }

      if (source === "preference") {
        explicitSelectionRef.current = true;
        setSelectedCode(matched.code);
        writeClientStorage(CURRENCY_STORAGE_KEY, matched.code);
        return;
      }

      if (explicitSelectionRef.current) return;

      const hasLocalPref =
        readClientCookie(CURRENCY_COOKIE_NAME) ?? readClientStorage(CURRENCY_STORAGE_KEY);
      if (hasLocalPref && byCode.has(hasLocalPref.trim().toUpperCase())) {
        return;
      }

      if (source === "geo" || source === "accept_language") {
        setSelectedCode(matched.code);
      }
    },
    [byCode],
  );

  const setCurrency = React.useCallback(
    (code: string) => {
      const matched = byCode.get(code.trim().toUpperCase());
      if (!matched) return;

      explicitSelectionRef.current = true;
      setSelectedCode(matched.code);
      writeClientCookie(CURRENCY_COOKIE_NAME, matched.code);
      writeClientStorage(CURRENCY_STORAGE_KEY, matched.code);

      void setPreferredCurrencyAction({ code: matched.code }).then((res) => {
        if (res.ok) {
          router.refresh();
        }
      });
    },
    [byCode, router],
  );

  const formatPrice = React.useCallback(
    (amount: MoneyInput, options?: FormatPriceOptions) => {
      return formatPriceHelper(amount, activeCurrency, options);
    },
    [activeCurrency],
  );

  const convertFromBase = React.useCallback(
    (amount: MoneyInput) => {
      return convertAmountFromBase(amount, activeCurrency).toFixed(activeCurrency.decimalPlaces);
    },
    [activeCurrency],
  );

  const convertToBase = React.useCallback(
    (displayAmount: MoneyInput) => {
      return convertDisplayToBase(displayAmount, activeCurrency).toFixed(2);
    },
    [activeCurrency],
  );

  const contextValue = React.useMemo<CurrencyContextValue>(
    () => ({
      currencies: safeList,
      baseCurrency,
      defaultCurrency,
      currency: activeCurrency,
      isBaseCurrency: activeCurrency.code === baseCurrency.code,
      setCurrency,
      formatPrice,
      convertFromBase,
      convertToBase,
    }),
    [
      safeList,
      baseCurrency,
      defaultCurrency,
      activeCurrency,
      setCurrency,
      formatPrice,
      convertFromBase,
      convertToBase,
    ],
  );

  // What the server rendered: used by components while they hydrate (see useHydrationSafe).
  const serverCurrency = byCode.get(initialResolvedCode) ?? defaultCurrency;
  const hydrationValue = React.useMemo<CurrencyContextValue>(
    () => ({
      ...contextValue,
      currency: serverCurrency,
      isBaseCurrency: serverCurrency.code === baseCurrency.code,
      formatPrice: (amount, options) => formatPriceHelper(amount, serverCurrency, options),
      convertFromBase: (amount) =>
        convertAmountFromBase(amount, serverCurrency).toFixed(serverCurrency.decimalPlaces),
      convertToBase: (amount) => convertDisplayToBase(amount, serverCurrency).toFixed(2),
    }),
    [contextValue, serverCurrency, baseCurrency.code],
  );

  const internalValue = React.useMemo<CurrencyInternalContext>(
    () => ({
      ...contextValue,
      applyServerDetection,
    }),
    [contextValue, applyServerDetection],
  );

  return (
    <CurrencyContext.Provider value={contextValue}>
      <HydrationCurrencyContext.Provider value={hydrationValue}>
        <InternalCurrencyContext.Provider value={internalValue}>
          {children}
        </InternalCurrencyContext.Provider>
      </HydrationCurrencyContext.Provider>
    </CurrencyContext.Provider>
  );
}

export function CurrencyHydrator({
  detectedCode,
  detectionSource,
}: {
  detectedCode: string;
  detectionSource: DetectionSource;
}) {
  const internal = React.useContext(InternalCurrencyContext);

  React.useLayoutEffect(() => {
    internal?.applyServerDetection(detectedCode, detectionSource);
  }, [detectedCode, detectionSource, internal]);

  return null;
}

const HydrationCurrencyContext = React.createContext<CurrencyContextValue | null>(null);
const noopSubscribe = () => () => {};

/**
 * The visitor's saved currency is applied right after the page shell hydrates, but sections
 * inside Suspense hydrate later against server HTML rendered in the default currency. While a
 * component is hydrating it gets the server currency, then re-renders with the active one.
 */
function useHydrationSafe(ctx: CurrencyContextValue | null): CurrencyContextValue | null {
  const hydrationCtx = React.useContext(HydrationCurrencyContext);
  const hydrated = React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  return hydrated ? ctx : (hydrationCtx ?? ctx);
}

export function useOptionalCurrency(): CurrencyContextValue | null {
  return useHydrationSafe(React.useContext(CurrencyContext));
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useHydrationSafe(React.useContext(CurrencyContext));
  if (ctx) return ctx;
  return {
    currencies: [FALLBACK_BASE_CURRENCY],
    baseCurrency: FALLBACK_BASE_CURRENCY,
    defaultCurrency: FALLBACK_BASE_CURRENCY,
    currency: FALLBACK_BASE_CURRENCY,
    isBaseCurrency: true,
    setCurrency: () => {},
    formatPrice: (amount, options) =>
      options?.exact
        ? formatMoney(amount, FALLBACK_BASE_CURRENCY.code, options.locale)
        : formatPriceHelper(amount, FALLBACK_BASE_CURRENCY, options),
    convertFromBase: (amount) => convertAmountFromBase(amount, FALLBACK_BASE_CURRENCY).toFixed(2),
    convertToBase: (amount) => convertDisplayToBase(amount, FALLBACK_BASE_CURRENCY).toFixed(2),
  };
}
