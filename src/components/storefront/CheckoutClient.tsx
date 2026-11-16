"use client";

import { fill, useUiText } from "@/components/providers/UiTextProvider";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Lock,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";
import { AnimatedCounter } from "@/components/motion/AnimatedCounter";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { CustomizedSpecsBadge } from "@/components/shared/CustomizedSpecsBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import {
  CountrySelectField,
  PhoneWithDialCodeInput,
  StateRegionField,
} from "@/components/storefront/AddressCountryFields";
import { StripePaymentBox } from "@/components/storefront/StripePaymentBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { getCountryMeta, getCountryStates } from "@/lib/countries";
import { isCurrencySupportedByProvider } from "@/lib/currency";
import { formatMoneyExact } from "@/lib/money";
import { cn } from "@/lib/utils";
import { fadeInVariants, slideStepVariants, useReducedMotionSafe } from "@/lib/motion";
import type { CheckoutQuoteDTO } from "@/modules/orders/checkout-quote";
import {
  confirmRazorpayPaymentAction,
  confirmSandboxPaymentAction,
  createCheckoutOrderAction,
  quoteCheckoutAction,
  retryOrderPaymentAction,
} from "@/modules/orders/order.actions";
import {
  createCheckoutOrderSchema,
  type CreateCheckoutOrderInput,
} from "@/modules/orders/order.schemas";
import type {
  CheckoutBootstrapDTO,
  CreatedOrderResultDTO,
  OrderConfirmationDTO,
  SavedAddressDTO,
} from "@/modules/orders/order.service";
import { visitorStore } from "@/modules/storefront/visitor-store";

interface RazorpayWindow extends Window {
  Razorpay?: new (options: Record<string, unknown>) => {
    open: () => void;
    on: (event: "payment.failed", cb: (res: { error?: { description?: string } }) => void) => void;
  };
}

interface CheckoutClientProps {
  bootstrap: CheckoutBootstrapDTO;
  initialRetryOrder?: {
    order: OrderConfirmationDTO;
    guestToken: string | null;
  } | null;
}

export function CheckoutClient({ bootstrap, initialRetryOrder = null }: CheckoutClientProps) {
  const t = useUiText().checkout;
  const router = useRouter();
  const { currency, baseCurrency, isBaseCurrency, formatPrice } = useCurrency();
  const reducedMotion = useReducedMotionSafe();
  const [mobileSummaryOpen, setMobileSummaryOpen] = React.useState(false);
  const [addressSheetOpen, setAddressSheetOpen] = React.useState(false);
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);
  const [quote, setQuote] = React.useState<CheckoutQuoteDTO | null>(bootstrap.initialQuote);

  React.useEffect(() => {
    const vv = window.visualViewport;
    const isInputFocused = () => {
      const el = document.activeElement;
      return Boolean(
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT"),
      );
    };
    const updateKeyboard = () => {
      if (vv) {
        setKeyboardOpen(vv.height < window.innerHeight * 0.78 && isInputFocused());
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
      ) {
        if (vv && vv.height < window.innerHeight * 0.78) {
          setKeyboardOpen(true);
        }
      }
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!isInputFocused()) setKeyboardOpen(false);
      }, 100);
    };
    vv?.addEventListener("resize", updateKeyboard);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      vv?.removeEventListener("resize", updateKeyboard);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [isQuoting, setIsQuoting] = React.useState(false);

  const [createdOrder, setCreatedOrder] = React.useState<CreatedOrderResultDTO | null>(null);
  const [paymentFailureNotice, setPaymentFailureNotice] = React.useState<string | null>(
    initialRetryOrder?.order.status === "PAYMENT_FAILED" ? t.retryNotice : null,
  );
  const [sandboxBusy, setSandboxBusy] = React.useState(false);

  const newIdempotencyKey = React.useCallback(
    () =>
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
    [],
  );
  const [idempotencyKey, setIdempotencyKey] = React.useState<string>(newIdempotencyKey);
  // Synchronous guard: blocks a second submit before React re-renders the disabled button.
  const submitInFlightRef = React.useRef(false);
  const reservationMsLeft = useReservationCountdown(createdOrder?.reservedUntil ?? null);
  const reservationExpired = reservationMsLeft !== null && reservationMsLeft <= 0;

  const defaultAddr: SavedAddressDTO | undefined =
    bootstrap.savedAddresses.find((a) => a.isDefaultShipping) ?? bootstrap.savedAddresses[0];
  const initialCountry = defaultAddr?.country ?? bootstrap.settings.defaultCountry ?? "US";
  const [selectedSavedAddressId, setSelectedSavedAddressId] = React.useState<string | "new">(
    defaultAddr?.id ?? "new",
  );
  // With a saved address selected, its fields stay hidden unless the shopper asks to edit them.
  const [editingSavedAddress, setEditingSavedAddress] = React.useState(false);

  const form = useForm({
    resolver: zodResolver(createCheckoutOrderSchema),
    defaultValues: {
      email: bootstrap.userEmail ?? "",
      shippingAddress: {
        fullName: defaultAddr?.fullName ?? bootstrap.userName ?? "",
        phone: defaultAddr?.phone ?? "",
        line1: defaultAddr?.line1 ?? "",
        line2: defaultAddr?.line2 ?? "",
        city: defaultAddr?.city ?? "",
        state: defaultAddr?.state ?? "",
        postalCode: defaultAddr?.postalCode ?? "",
        country: initialCountry,
      },
      billingSameAsShipping: true,
      billingAddress: null as CreateCheckoutOrderInput["billingAddress"],
      shippingZoneId: bootstrap.initialQuote?.selectedZone.id ?? null,
      giftNote: "",
      customerNote: "",
      saveAddressToAccount: false,
      idempotencyKey,
    },
  });

  const watchedEmail = useWatch({ control: form.control, name: "email" });
  const watchedLine1 = useWatch({ control: form.control, name: "shippingAddress.line1" });
  const watchedCountry = useWatch({ control: form.control, name: "shippingAddress.country" });
  const watchedBillingCountry = useWatch({ control: form.control, name: "billingAddress.country" });
  const watchedZoneId = useWatch({ control: form.control, name: "shippingZoneId" });
  const watchedBillingSame = useWatch({ control: form.control, name: "billingSameAsShipping" });
  const shippingCountryMeta = getCountryMeta(watchedCountry);
  const billingCountryMeta = getCountryMeta(
    watchedBillingCountry ?? bootstrap.settings.defaultCountry ?? "US",
  );

  React.useEffect(() => {
    visitorStore.setBagCount(bootstrap.cart.itemCount);
  }, [bootstrap.cart.itemCount]);

  // If landed via ?order=ORD-...&token=... retry link, initialize retry payment session immediately
  const retryBootstrappedRef = React.useRef(false);
  React.useEffect(() => {
    if (!initialRetryOrder || retryBootstrappedRef.current) return;
    retryBootstrappedRef.current = true;
    void (async () => {
      const res = await retryOrderPaymentAction({
        orderNumber: initialRetryOrder.order.orderNumber,
        guestToken: initialRetryOrder.guestToken,
      });
      if (res.ok) {
        setCreatedOrder(res.data);
      } else {
        setPaymentFailureNotice(res.error.message);
      }
    })();
  }, [initialRetryOrder]);

  const updateQuote = React.useCallback(
    async (country: string, zoneId?: string | null, currencyCode: string = currency.code) => {
      if (!country || country.length !== 2 || bootstrap.cart.items.length === 0) return;
      setIsQuoting(true);
      setQuoteError(null);
      const res = await quoteCheckoutAction({
        shippingCountry: country,
        shippingZoneId: zoneId ?? null,
        currency: currencyCode,
      });
      setIsQuoting(false);
      if (!res.ok) {
        setQuoteError(res.error.message);
        return;
      }
      setQuote(res.data);
      form.setValue("shippingZoneId", res.data.selectedZone.id);
    },
    [bootstrap.cart.items.length, currency.code, form],
  );

  React.useEffect(() => {
    if (createdOrder || initialRetryOrder || bootstrap.cart.items.length === 0) return;
    if (!watchedCountry || watchedCountry.length !== 2) return;
    if (quote?.currency === currency.code) return;
    let active = true;
    void quoteCheckoutAction({
      shippingCountry: watchedCountry,
      shippingZoneId: watchedZoneId ?? null,
      currency: currency.code,
    }).then((res) => {
      if (!active) return;
      if (!res.ok) {
        setQuoteError(res.error.message);
        return;
      }
      setQuoteError(null);
      setQuote(res.data);
      form.setValue("shippingZoneId", res.data.selectedZone.id);
    });
    return () => {
      active = false;
    };
  }, [
    bootstrap.cart.items.length,
    createdOrder,
    currency.code,
    form,
    initialRetryOrder,
    quote?.currency,
    watchedCountry,
    watchedZoneId,
  ]);

  function handleSelectSavedAddress(addr: SavedAddressDTO) {
    setSelectedSavedAddressId(addr.id);
    setEditingSavedAddress(false);
    form.setValue("saveAddressToAccount", false, { shouldValidate: false });
    form.setValue("shippingAddress.fullName", addr.fullName, { shouldValidate: true });
    form.setValue("shippingAddress.phone", addr.phone, { shouldValidate: true });
    form.setValue("shippingAddress.line1", addr.line1, { shouldValidate: true });
    form.setValue("shippingAddress.line2", addr.line2 ?? "", { shouldValidate: false });
    form.setValue("shippingAddress.city", addr.city, { shouldValidate: true });
    form.setValue("shippingAddress.state", addr.state, { shouldValidate: true });
    form.setValue("shippingAddress.postalCode", addr.postalCode, { shouldValidate: true });
    form.setValue("shippingAddress.country", addr.country, { shouldValidate: true });
    void updateQuote(addr.country, null);
  }

  function handleSelectNewAddress() {
    const fallbackCountry = bootstrap.settings.defaultCountry ?? "US";
    setSelectedSavedAddressId("new");
    form.setValue("shippingAddress.fullName", bootstrap.userName ?? "", { shouldValidate: false });
    form.setValue("shippingAddress.phone", "", { shouldValidate: false });
    form.setValue("shippingAddress.line1", "", { shouldValidate: false });
    form.setValue("shippingAddress.line2", "", { shouldValidate: false });
    form.setValue("shippingAddress.city", "", { shouldValidate: false });
    form.setValue("shippingAddress.state", "", { shouldValidate: false });
    form.setValue("shippingAddress.postalCode", "", { shouldValidate: false });
    form.setValue("shippingAddress.country", fallbackCountry, { shouldValidate: false });
    void updateQuote(fallbackCountry, null);
    if (
      typeof window !== "undefined" &&
      window.innerWidth < 768 &&
      bootstrap.savedAddresses.length > 0
    ) {
      setAddressSheetOpen(true);
    }
  }

  function handleBillingToggle(same: boolean) {
    form.setValue("billingSameAsShipping", same, { shouldValidate: true });
    if (same) {
      form.setValue("billingAddress", null, { shouldValidate: false });
    } else {
      const currentShipping = form.getValues("shippingAddress");
      form.setValue("billingAddress", {
        ...currentShipping,
        line2: currentShipping.line2 ?? "",
      });
    }
  }

  const onCreateOrder = (event?: React.BaseSyntheticEvent) =>
    form.handleSubmit(async (rawValues) => {
      if (submitInFlightRef.current) return;
      submitInFlightRef.current = true;
      const values = rawValues as CreateCheckoutOrderInput;
      setPaymentFailureNotice(null);

      const res = await createCheckoutOrderAction({
        ...values,
        currency: currency.code,
        idempotencyKey,
      }).finally(() => {
        submitInFlightRef.current = false;
      });

      if (!res.ok) {
        // A failed attempt must never be replayed: the next submit starts a fresh checkout.
        setIdempotencyKey(newIdempotencyKey());
        if (res.error.fieldErrors) {
          for (const messages of Object.values(res.error.fieldErrors)) {
            if (messages[0]) {
              void notifyError(messages[0]);
              break;
            }
          }
        } else {
          void notifyError(res.error.message);
        }
        return;
      }

      visitorStore.setBagCount(0);
      // A replayed submit returns no guest token; keep the one from the first response.
      setCreatedOrder((prev) => ({
        ...res.data,
        guestToken:
          res.data.guestToken ??
          (prev?.orderNumber === res.data.orderNumber ? prev.guestToken : null),
      }));
      void notifySuccess(fill(t.toasts.orderReserved, { orderNumber: res.data.orderNumber }));
    }, onInvalidCheckout)(event);

  // A missing or invalid field must never look like "nothing happened": say so and jump to it.
  function onInvalidCheckout() {
    void notifyError(t.toasts.fixFields);
    window.requestAnimationFrame(() => {
      const field = document.querySelector<HTMLElement>('#checkout-form [aria-invalid="true"]');
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.focus({ preventScroll: true });
    });
  }

  async function handleRetryOrderPayment() {
    if (!createdOrder || sandboxBusy) return;
    setSandboxBusy(true);
    setPaymentFailureNotice(null);
    const res = await retryOrderPaymentAction({
      orderNumber: createdOrder.orderNumber,
      guestToken: createdOrder.guestToken,
    });
    setSandboxBusy(false);

    if (!res.ok) {
      void notifyError(res.error.message);
      setPaymentFailureNotice(res.error.message);
      return;
    }

    setCreatedOrder(res.data);
    void notifyInfo(t.toasts.newSession);
  }

  async function handleSandboxOutcome(outcome: "succeed" | "fail") {
    if (!createdOrder || sandboxBusy) return;
    setSandboxBusy(true);
    setPaymentFailureNotice(null);

    const res = await confirmSandboxPaymentAction({
      orderNumber: createdOrder.orderNumber,
      outcome,
      guestToken: createdOrder.guestToken,
    });
    setSandboxBusy(false);

    if (!res.ok) {
      void notifyError(res.error.message);
      setPaymentFailureNotice(res.error.message);
      return;
    }

    if (res.data.status === "PAID") {
      void notifySuccess(fill(t.toasts.paymentSettled, { orderNumber: res.data.orderNumber }));
      const tokenQuery = createdOrder.guestToken
        ? `?token=${encodeURIComponent(createdOrder.guestToken)}`
        : "";
      router.replace(
        `/orders/${encodeURIComponent(res.data.orderNumber)}/confirmation${tokenQuery}`,
      );
      return;
    }

    setCreatedOrder({ ...createdOrder, status: res.data.status });
    setPaymentFailureNotice(t.sandboxDeclined);
    void notifyError(t.toasts.declined);
  }

  async function handleOpenRazorpayModal() {
    if (!createdOrder?.payment.razorpayOrderId || !createdOrder.payment.keyId) return;
    const win = window as RazorpayWindow;

    if (!win.Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(t.toasts.razorpayLoadFailed));
        document.body.appendChild(script);
      });
    }

    const styles = getComputedStyle(document.documentElement);
    const accentColor = styles.getPropertyValue("--accent").trim();
    const tokenQuery = createdOrder.guestToken
      ? `?token=${encodeURIComponent(createdOrder.guestToken)}`
      : "";

    const orderNumber = createdOrder.orderNumber;
    const confirmationUrl = `/orders/${encodeURIComponent(orderNumber)}/confirmation${tokenQuery}`;
    const shipping = form.getValues("shippingAddress");

    const instance = new win.Razorpay!({
      key: createdOrder.payment.keyId,
      order_id: createdOrder.payment.razorpayOrderId,
      name: bootstrap.settings.storeName,
      description: fill(t.payment.razorpayDescription, { orderNumber }),
      prefill: {
        name: shipping?.fullName || undefined,
        email: form.getValues("email") || undefined,
        // E.164 without spaces, e.g. "+919870008173", so Razorpay reads the country correctly.
        contact: shipping?.phone ? shipping.phone.replace(/[^\d+]/g, "") : undefined,
      },
      // No Razorpay saved-card login: its phone OTP step fails for many international
      // numbers ("Login Failed") and blocks the card payment itself.
      remember_customer: false,
      notes: { orderNumber },
      theme: accentColor ? { color: accentColor } : undefined,
      retry: { enabled: true, max_count: 3 },
      modal: {
        // Closed without paying: the order stays reserved and the customer can try again.
        ondismiss: () => void notifyInfo(t.toasts.razorpayClosed),
      },
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        // Verify on the server straight away (the webhook is a backup), then show the receipt.
        void notifyInfo(t.toasts.razorpayVerifying);
        const res = await confirmRazorpayPaymentAction({
          orderNumber,
          guestToken: createdOrder.guestToken ?? null,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
        if (!res.ok) {
          // Payment may still settle via webhook; the confirmation page shows the live status.
          void notifyError(t.toasts.razorpayVerifyDelayed);
        } else {
          void notifySuccess(fill(t.toasts.paymentSettled, { orderNumber }));
        }
        router.replace(confirmationUrl);
      },
    });
    instance.on("payment.failed", (res) => {
      void notifyError(res.error?.description || t.toasts.razorpayFailed);
    });
    instance.open();
  }

  if (bootstrap.cart.items.length === 0 && !createdOrder && !initialRetryOrder) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title={t.emptyTitle}
        description={t.emptyDescription}
        actionLabel={t.emptyAction}
        actionHref="/collections"
      />
    );
  }

  const activeQuote =
    !createdOrder && !initialRetryOrder && quote && quote.currency === currency.code ? quote : null;

  const displayCurrency =
    createdOrder?.currency ?? initialRetryOrder?.order.currency ?? currency.code;
  const displayDecimals =
    createdOrder?.currencyDecimals ??
    initialRetryOrder?.order.currencyDecimals ??
    currency.decimalPlaces;

  const displaySubtotal =
    createdOrder?.subtotal ??
    initialRetryOrder?.order.subtotal ??
    activeQuote?.subtotal ??
    bootstrap.cart.subtotal;
  const displayShipping =
    createdOrder?.shippingCost ??
    initialRetryOrder?.order.shippingCost ??
    activeQuote?.shippingCost ??
    null;
  const displayTax =
    createdOrder?.taxAmount ?? initialRetryOrder?.order.taxAmount ?? activeQuote?.taxAmount ?? null;
  const displayTotal =
    createdOrder?.total ??
    initialRetryOrder?.order.total ??
    activeQuote?.total ??
    bootstrap.cart.subtotal;

  const isBaseQuotePending = !createdOrder && !initialRetryOrder && !activeQuote;
  const activeBaseTotal =
    createdOrder?.baseTotal ??
    initialRetryOrder?.order.baseTotal ??
    activeQuote?.baseTotal ??
    bootstrap.cart.subtotal;
  const effectiveExchangeRate =
    createdOrder?.exchangeRate ??
    initialRetryOrder?.order.exchangeRate ??
    activeQuote?.exchangeRate ??
    currency.exchangeRate;

  const gatewayProvider = createdOrder?.payment.provider ?? bootstrap.paymentConfig.provider;
  const chargeInBaseFallback = createdOrder
    ? createdOrder.chargeInBaseFallback
    : initialRetryOrder
      ? initialRetryOrder.order.chargedCurrency !== initialRetryOrder.order.currency
      : !isBaseCurrency && !isCurrencySupportedByProvider(gatewayProvider, displayCurrency);

  const fmtSummaryAmount = (val: string, useBaseConversionWhenPending: boolean) => {
    if (useBaseConversionWhenPending && isBaseQuotePending) {
      return formatPrice(val, { exact: true });
    }
    return formatMoneyExact(val, displayCurrency, "en-US", displayDecimals);
  };

  const isPaymentPhase = Boolean(createdOrder || initialRetryOrder);
  const chargedLabel = createdOrder
    ? formatMoneyExact(
        createdOrder.chargedAmount,
        createdOrder.chargedCurrency,
        "en-US",
        createdOrder.chargeInBaseFallback
          ? baseCurrency.decimalPlaces
          : createdOrder.currencyDecimals,
      )
    : "";
  const summaryItems = initialRetryOrder?.order.items ?? bootstrap.cart.items;
  const summaryItemCount = summaryItems.reduce((sum, item) => sum + item.quantity, 0);
  const hasSignatureNotice = Boolean(
    quote?.signatureRequired ||
    initialRetryOrder?.order.signatureRequired ||
    bootstrap.cart.signatureRequired,
  );

  const steps = [
    {
      number: 1,
      label: t.steps.contact,
      done: isPaymentPhase || Boolean(watchedEmail && watchedEmail.includes("@")),
      active: !isPaymentPhase,
    },
    {
      number: 2,
      label: t.steps.shipping,
      done: isPaymentPhase || Boolean(watchedLine1 && watchedLine1.trim().length > 2),
      active: !isPaymentPhase && Boolean(watchedEmail && watchedEmail.includes("@")),
    },
    {
      number: 3,
      label: t.steps.delivery,
      done: isPaymentPhase,
      active: !isPaymentPhase && Boolean(watchedLine1 && watchedLine1.trim().length > 2),
    },
    {
      number: 4,
      label: t.steps.payment,
      done: createdOrder?.status === "PAID",
      active: isPaymentPhase,
    },
  ];

  const orderSummaryContent = (
    <>
      <ul
        className={cn(
          "divide-y divide-border border-y border-border",
          summaryItems.length > 4 && "max-h-[22rem] overflow-y-auto overscroll-contain pr-1",
        )}
      >
        {summaryItems.map((item) => {
          const isRetryItem = "titleSnapshot" in item;
          const imgUrl = isRetryItem ? item.imageUrlSnapshot : item.imageUrl;
          const title = isRetryItem ? item.titleSnapshot : item.productName;
          const variantLabel = isRetryItem ? item.variantTitleSnapshot : item.variantTitle;
          const isSeedImage = imgUrl?.startsWith("/images/seed/") ?? false;
          return (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
                {imgUrl ? (
                  <Image
                    src={imgUrl}
                    alt={title}
                    fill
                    sizes="64px"
                    className={
                      isSeedImage
                        ? "object-cover object-center dark:brightness-90"
                        : "object-cover object-center"
                    }
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                <p className="tabular-nums-price mt-0.5 truncate text-xs text-muted-foreground">
                  {fill(t.summary.qty, { variant: variantLabel, quantity: item.quantity })}
                </p>
                <CustomizedSpecsBadge
                  compact
                  requestId={item.customizationRequestId}
                  requestNumber={item.customizationRequestNumber}
                  summaryLines={item.customizationSummaryLines}
                />
              </div>
              <p className="tabular-nums-price shrink-0 text-sm font-semibold text-foreground">
                {isRetryItem
                  ? formatMoneyExact(item.lineTotal, displayCurrency, "en-US", displayDecimals)
                  : formatPrice(item.lineTotal, { exact: true })}
              </p>
            </li>
          );
        })}
      </ul>

      <dl className="mt-4 space-y-2.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{t.summary.subtotal}</dt>
          <dd className="tabular-nums-price font-medium text-foreground">
            <AnimatedCounter value={fmtSummaryAmount(displaySubtotal, true)} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">
            {activeQuote?.selectedZone.name ??
              initialRetryOrder?.order.shippingMethodName ??
              t.summary.shippingFallback}
          </dt>
          <dd className="tabular-nums-price font-medium text-foreground">
            {isQuoting || isBaseQuotePending
              ? t.summary.calculating
              : displayShipping === null
                ? t.summary.selectCountry
                : Number(displayShipping) === 0
                  ? t.summary.complimentary
                  : formatMoneyExact(displayShipping, displayCurrency, "en-US", displayDecimals)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">
            {activeQuote?.taxLabel ?? bootstrap.settings.taxLabel}
            {bootstrap.settings.taxInclusive ? t.summary.taxIncluded : ""}
          </dt>
          <dd className="tabular-nums-price font-medium text-foreground">
            {displayTax === null || isBaseQuotePending
              ? "—"
              : formatMoneyExact(displayTax, displayCurrency, "en-US", displayDecimals)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3.5">
          <dt className="text-base font-semibold text-foreground">{t.summary.total}</dt>
          <dd className="tabular-nums-price text-xl font-semibold text-foreground">
            <AnimatedCounter value={fmtSummaryAmount(displayTotal, true)} />
          </dd>
        </div>
      </dl>

      <p className="tabular-nums-price mt-3 text-xs text-muted-foreground">
        {fill(t.summary.pricesShownIn, { currency: displayCurrency })}
        {displayCurrency !== baseCurrency.code
          ? fill(t.summary.rateSuffix, {
              base: baseCurrency.code,
              rate: Number(effectiveExchangeRate).toFixed(4),
              currency: displayCurrency,
            })
          : "."}
      </p>

      {chargeInBaseFallback && (
        <div
          role="note"
          className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-foreground"
        >
          {fill(t.summary.baseChargeBefore, { base: baseCurrency.code })}{" "}
          <strong className="tabular-nums-price font-semibold">
            {formatMoneyExact(
              createdOrder?.chargedAmount ?? activeBaseTotal,
              createdOrder?.chargedCurrency ?? baseCurrency.code,
              "en-US",
              baseCurrency.decimalPlaces,
            )}{" "}
            ({createdOrder?.chargedCurrency ?? baseCurrency.code})
          </strong>
          {fill(t.summary.baseChargeAfter, { currency: displayCurrency })}
        </div>
      )}

      {hasSignatureNotice && (
        <div
          role="note"
          className="mt-4 flex items-start gap-2.5 rounded-md border border-border bg-surface-2 p-3.5 text-xs leading-relaxed text-muted-foreground"
        >
          <ShieldCheck
            className="mt-0.5 size-5 shrink-0 stroke-[1.5] text-accent-text"
            aria-hidden="true"
          />
          <span>{t.summary.signatureNote}</span>
        </div>
      )}
    </>
  );

  const highestActiveStep = steps.reduce(
    (maxStep, s) => (s.active || s.done ? Math.max(maxStep, s.number) : maxStep),
    1,
  );
  const currentStep = steps[highestActiveStep - 1] ??
    steps[0] ?? { number: 1, label: t.steps.contact, done: false, active: true };
  const stepProgressRatio = Math.min(1, Math.max(0.25, highestActiveStep / 4));

  const renderShippingAddressFields = (inSheet: boolean) => (
    <div className="grid gap-4 min-[480px]:grid-cols-2">
      <FormField
        id="shipping-full-name"
        label={t.address.fullName}
        required
        error={form.formState.errors.shippingAddress?.fullName?.message}
      >
        {(aria) => (
          <Input
            {...aria}
            autoComplete="shipping name"
            {...form.register("shippingAddress.fullName")}
          />
        )}
      </FormField>

      <FormField
        id="shipping-country"
        label={t.address.country}
        required
        error={form.formState.errors.shippingAddress?.country?.message}
      >
        {(aria) => (
          <Controller
            control={form.control}
            name="shippingAddress.country"
            render={({ field }) => (
              <CountrySelectField
                id={aria.id}
                value={field.value}
                inModal={inSheet}
                allowedCountryCodes={bootstrap.settings.supportedCountries}
                ariaDescribedBy={aria["aria-describedby"]}
                onChange={(nextCountry) => {
                  field.onChange(nextCountry);
                  if (getCountryStates(nextCountry).length > 0) {
                    form.setValue("shippingAddress.state", "", { shouldValidate: false });
                  }
                  void updateQuote(nextCountry, null);
                }}
              />
            )}
          />
        )}
      </FormField>

      <div className="min-[480px]:col-span-2">
        <FormField
          id="shipping-phone"
          label={t.address.phone}
          required
          hint={t.address.phoneHint}
          error={form.formState.errors.shippingAddress?.phone?.message}
        >
          {(aria) => (
            <Controller
              control={form.control}
              name="shippingAddress.phone"
              render={({ field }) => (
                <PhoneWithDialCodeInput
                  id={aria.id}
                  country={watchedCountry}
                  value={field.value}
                  autoComplete="shipping tel"
                  ariaDescribedBy={aria["aria-describedby"]}
                  ariaInvalid={Boolean(form.formState.errors.shippingAddress?.phone)}
                  required
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          )}
        </FormField>
      </div>

      <div className="min-[480px]:col-span-2">
        <FormField
          id="shipping-line1"
          label={t.address.street}
          required
          error={form.formState.errors.shippingAddress?.line1?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              autoComplete="shipping address-line1"
              {...form.register("shippingAddress.line1")}
            />
          )}
        </FormField>
      </div>

      <div className="min-[480px]:col-span-2">
        <FormField
          id="shipping-line2"
          label={t.address.apartment}
          error={form.formState.errors.shippingAddress?.line2?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              autoComplete="shipping address-line2"
              {...form.register("shippingAddress.line2")}
            />
          )}
        </FormField>
      </div>

      <div className="min-[480px]:col-span-2">
        <FormField
          id="shipping-state"
          label={shippingCountryMeta?.stateLabel ?? t.address.state}
          required
          error={form.formState.errors.shippingAddress?.state?.message}
        >
          {(aria) => (
            <Controller
              control={form.control}
              name="shippingAddress.state"
              render={({ field }) => (
                <StateRegionField
                  id={aria.id}
                  country={watchedCountry}
                  value={field.value}
                  autoComplete="shipping address-level1"
                  inModal={inSheet}
                  required
                  ariaDescribedBy={aria["aria-describedby"]}
                  ariaInvalid={Boolean(form.formState.errors.shippingAddress?.state)}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          )}
        </FormField>
      </div>

      <FormField
        id="shipping-city"
        label={t.address.city}
        required
        error={form.formState.errors.shippingAddress?.city?.message}
      >
        {(aria) => (
          <Input
            {...aria}
            autoComplete="shipping address-level2"
            {...form.register("shippingAddress.city")}
          />
        )}
      </FormField>

      <FormField
        id="shipping-postal"
        label={t.address.postal}
        required
        hint={
          shippingCountryMeta
            ? fill(t.address.postalHint, { example: shippingCountryMeta.postalExample })
            : undefined
        }
        error={form.formState.errors.shippingAddress?.postalCode?.message}
      >
        {(aria) => (
          <Input
            {...aria}
            autoComplete="shipping postal-code"
            {...form.register("shippingAddress.postalCode")}
          />
        )}
      </FormField>
    </div>
  );

  return (
    <div className={!isPaymentPhase ? "space-y-6 pb-24 sm:pb-0" : "space-y-6"}>
      {/* 4-Step Progress Indicator */}
      <nav
        aria-label={t.steps.ariaLabel}
        className="rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm md:px-6"
      >
        <div className="flex items-center justify-between gap-3 md:hidden">
          <p className="text-sm font-semibold text-foreground">
            {fill(t.steps.stepOf, { number: currentStep.number, label: currentStep.label })}
          </p>
          <span className="tabular-nums-price text-xs text-muted-foreground">
            {fill(t.steps.complete, { done: steps.filter((s) => s.done).length })}
          </span>
        </div>
        <ol className="hidden md:grid md:grid-cols-4 md:gap-4">
          {steps.map((step) => (
            <li
              key={step.number}
              aria-current={step.number === currentStep.number ? "step" : undefined}
              className="flex flex-row items-center gap-2 text-left"
            >
              <span
                className={`tabular-nums-price flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-150 ease-out ${
                  step.done
                    ? "border-accent bg-accent text-accent-foreground"
                    : step.active
                      ? "border-accent bg-surface-2 text-accent-text"
                      : "border-border bg-background text-muted-foreground"
                }`}
              >
                {step.done ? (
                  <Check className="size-3.5 stroke-[2]" aria-hidden="true" />
                ) : (
                  step.number
                )}
              </span>
              <span
                className={`truncate text-sm font-medium ${
                  step.active || step.done ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
        <div
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-border/80 md:mt-3 md:h-1"
          aria-hidden="true"
        >
          <div
            className="ma-progress-fill h-full w-full bg-accent"
            style={{ transform: `scaleX(${stepProgressRatio})` }}
          />
        </div>
      </nav>

      {/* Collapsible Order Summary for Mobile & Tablet (< 1024px) via CSS grid-rows */}
      <div className="rounded-xl border border-border bg-card shadow-sm lg:hidden">
        <button
          type="button"
          aria-expanded={mobileSummaryOpen}
          aria-controls="checkout-mobile-summary-panel"
          onClick={() => setMobileSummaryOpen((prev) => !prev)}
          className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-foreground select-none focus-visible:outline-2 focus-visible:outline-foreground/45 sm:px-6"
        >
          <span className="flex items-center gap-2">
            <span>{fill(t.summary.mobileToggle, { count: summaryItemCount })}</span>
            <ChevronDown
              className={`size-5 stroke-[1.5] text-muted-foreground transition-transform duration-200 ease-out ${mobileSummaryOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </span>
          <span className="tabular-nums-price text-base font-semibold text-foreground">
            <AnimatedCounter value={fmtSummaryAmount(displayTotal, true)} />
          </span>
        </button>
        <div
          id="checkout-mobile-summary-panel"
          className="ma-accordion-content"
          data-open={mobileSummaryOpen ? "true" : "false"}
        >
          <div className="ma-accordion-inner">
            <div className="border-t border-border px-4 pt-4 pb-5 sm:px-6">
              {orderSummaryContent}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="min-w-0 space-y-6 lg:col-span-7">
          <AnimatePresence mode="wait" initial={false} custom={isPaymentPhase ? 1 : -1}>
            {/* Phase A: Contact, Addresses & Shipping Selection */}
            {!isPaymentPhase ? (
              <m.form
                key="checkout-phase-details"
                custom={-1}
                variants={reducedMotion ? fadeInVariants : slideStepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                id="checkout-form"
                onSubmit={onCreateOrder}
                className="space-y-6"
                noValidate
              >
                {/* 1. Contact */}
                <section className="border-b border-border pb-6 last:border-b-0 sm:rounded-xl sm:border sm:bg-card sm:p-5 sm:shadow-sm md:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                    <div>
                      <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground sm:text-xl">
                        {t.contact.heading}
                      </h2>
                    </div>
                    {!bootstrap.userEmail && (
                      <p className="text-xs text-muted-foreground">
                        {t.contact.haveAccount}{" "}
                        <Link
                          href="/login?next=/checkout"
                          className="inline-flex min-h-11 items-center rounded-sm px-1 font-medium text-accent-text underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground/45 md:min-h-8"
                        >
                          {t.contact.signIn}
                        </Link>
                      </p>
                    )}
                  </div>

                  <div className="mt-4">
                    <FormField
                      id="checkout-email"
                      label={t.contact.emailLabel}
                      required
                      hint={t.contact.emailHint}
                      error={form.formState.errors.email?.message}
                    >
                      {(aria) => (
                        <Input
                          {...aria}
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder={t.contact.emailPlaceholder}
                          {...form.register("email")}
                        />
                      )}
                    </FormField>
                  </div>
                </section>

                {/* 2. Shipping & Billing Address */}
                <section className="border-b border-border pb-6 last:border-b-0 sm:rounded-xl sm:border sm:bg-card sm:p-5 sm:shadow-sm md:p-6">
                  <div className="border-b border-border pb-4">
                    <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground sm:text-xl">
                      {t.delivery.heading}
                    </h2>
                  </div>

                  {bootstrap.savedAddresses.length > 0 && (
                    <div className="mt-4 space-y-2.5">
                      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        {t.delivery.savedAddresses}
                      </p>
                      <div
                        role="radiogroup"
                        aria-label={t.delivery.savedAria}
                        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                      >
                        {bootstrap.savedAddresses.map((addr) => {
                          const selected = selectedSavedAddressId === addr.id;
                          return (
                            <button
                              key={addr.id}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => handleSelectSavedAddress(addr)}
                              className={`flex min-h-11 cursor-pointer flex-col justify-between gap-1.5 rounded-xl border p-3.5 text-left text-xs transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-accent ${
                                selected
                                  ? "border-accent bg-accent-tint ring-1 ring-accent"
                                  : "border-border bg-surface hover:border-border-strong"
                              }`}
                            >
                              <div className="flex w-full items-center justify-between gap-2">
                                <span className="truncate font-semibold text-foreground">
                                  {addr.label ?? t.delivery.savedFallback} — {addr.fullName}
                                </span>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  {addr.isDefaultShipping && (
                                    <Badge variant="primary">{t.delivery.defaultBadge}</Badge>
                                  )}
                                  {selected && (
                                    <Check className="size-4 text-accent-text" aria-hidden="true" />
                                  )}
                                </div>
                              </div>
                              <span className="block break-words text-muted-foreground">
                                {addr.line1}, {addr.city}, {addr.state} {addr.postalCode} (
                                {addr.country})
                              </span>
                              <span className="tabular-nums-price block text-[11px] text-muted-foreground">
                                {addr.phone}
                              </span>
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selectedSavedAddressId === "new"}
                          onClick={handleSelectNewAddress}
                          className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed p-3.5 text-xs font-semibold transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-accent ${
                            selectedSavedAddressId === "new"
                              ? "border-accent bg-accent-tint text-text ring-1 ring-accent"
                              : "border-border-strong bg-surface text-text-muted hover:border-accent hover:text-text"
                          }`}
                        >
                          <Plus className="size-4 stroke-[1.5]" aria-hidden="true" />
                          <span>{t.delivery.addNew}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!addressSheetOpen &&
                    (selectedSavedAddressId === "new" ||
                    editingSavedAddress ||
                    Boolean(form.formState.errors.shippingAddress) ? (
                      <div className="mt-4">{renderShippingAddressFields(false)}</div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingSavedAddress(true)}
                        className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-accent-text underline underline-offset-4"
                      >
                        {t.delivery.edit}
                      </button>
                    ))}

                  <Sheet open={addressSheetOpen} onOpenChange={setAddressSheetOpen}>
                    <SheetContent
                      side="bottom"
                      showDragHandle
                      className="flex max-h-[90dvh] flex-col p-0"
                    >
                      <SheetHeader className="border-b border-border px-4 py-3.5 text-left">
                        <SheetTitle>{t.delivery.sheetTitle}</SheetTitle>
                        <SheetDescription>{t.delivery.sheetDescription}</SheetDescription>
                      </SheetHeader>
                      <div className="flex-1 overflow-y-auto px-4 py-4">
                        {addressSheetOpen ? renderShippingAddressFields(true) : null}
                      </div>
                      <div className="safe-area-pb border-t border-border bg-card px-4 py-3.5">
                        <Button
                          type="button"
                          size="lg"
                          className="w-full"
                          onClick={() => setAddressSheetOpen(false)}
                        >
                          {t.delivery.useAddress}
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>

                  <div className="mt-5 space-y-1 border-t border-border pt-4">
                    {bootstrap.userEmail &&
                      bootstrap.savedAddresses.length < 10 &&
                      (selectedSavedAddressId === "new" ||
                        bootstrap.savedAddresses.length === 0) && (
                        <div className="flex min-h-11 items-center gap-3 text-sm text-foreground">
                          <Controller
                            control={form.control}
                            name="saveAddressToAccount"
                            render={({ field }) => (
                              <Checkbox
                                id="checkout-save-address"
                                checked={Boolean(field.value)}
                                onCheckedChange={(v) => field.onChange(Boolean(v))}
                              />
                            )}
                          />
                          <label
                            htmlFor="checkout-save-address"
                            className="cursor-pointer leading-snug"
                          >
                            {t.delivery.saveForNext}
                          </label>
                        </div>
                      )}

                    <div className="flex min-h-11 items-center gap-3 text-sm text-foreground">
                      <Checkbox
                        id="checkout-billing-same"
                        checked={Boolean(watchedBillingSame)}
                        onCheckedChange={(v) => handleBillingToggle(Boolean(v))}
                      />
                      <label
                        htmlFor="checkout-billing-same"
                        className="cursor-pointer leading-snug"
                      >
                        {t.delivery.billingSame}
                      </label>
                    </div>
                  </div>

                  {!watchedBillingSame && (
                    <div className="mt-5 grid gap-4 border-t border-border pt-5 min-[480px]:grid-cols-2">
                      <p className="text-sm font-semibold text-foreground min-[480px]:col-span-2">
                        {t.delivery.billingHeading}
                      </p>
                      <FormField
                        id="billing-full-name"
                        label={t.address.fullName}
                        required
                        error={form.formState.errors.billingAddress?.fullName?.message}
                      >
                        {(aria) => (
                          <Input
                            {...aria}
                            autoComplete="billing name"
                            {...form.register("billingAddress.fullName")}
                          />
                        )}
                      </FormField>
                      <FormField
                        id="billing-country"
                        label={t.address.country}
                        required
                        error={form.formState.errors.billingAddress?.country?.message}
                      >
                        {(aria) => (
                          <Controller
                            control={form.control}
                            name="billingAddress.country"
                            render={({ field }) => (
                              <CountrySelectField
                                id={aria.id}
                                value={field.value ?? bootstrap.settings.defaultCountry}
                                allowedCountryCodes={bootstrap.settings.supportedCountries}
                                ariaDescribedBy={aria["aria-describedby"]}
                                onChange={(nextCountry) => {
                                  field.onChange(nextCountry);
                                  if (getCountryStates(nextCountry).length > 0) {
                                    form.setValue("billingAddress.state", "", {
                                      shouldValidate: false,
                                    });
                                  }
                                }}
                              />
                            )}
                          />
                        )}
                      </FormField>
                      <div className="min-[480px]:col-span-2">
                        <FormField
                          id="billing-phone"
                          label={t.address.phone}
                          required
                          error={form.formState.errors.billingAddress?.phone?.message}
                        >
                          {(aria) => (
                            <Controller
                              control={form.control}
                              name="billingAddress.phone"
                              render={({ field }) => (
                                <PhoneWithDialCodeInput
                                  id={aria.id}
                                  country={
                                    watchedBillingCountry ?? bootstrap.settings.defaultCountry
                                  }
                                  value={field.value ?? ""}
                                  autoComplete="billing tel"
                                  ariaDescribedBy={aria["aria-describedby"]}
                                  ariaInvalid={Boolean(form.formState.errors.billingAddress?.phone)}
                                  required
                                  onChange={field.onChange}
                                  onBlur={field.onBlur}
                                />
                              )}
                            />
                          )}
                        </FormField>
                      </div>
                      <div className="min-[480px]:col-span-2">
                        <FormField
                          id="billing-line1"
                          label={t.address.street}
                          required
                          error={form.formState.errors.billingAddress?.line1?.message}
                        >
                          {(aria) => (
                            <Input
                              {...aria}
                              autoComplete="billing address-line1"
                              {...form.register("billingAddress.line1")}
                            />
                          )}
                        </FormField>
                      </div>
                      <FormField
                        id="billing-city"
                        label={t.address.city}
                        required
                        error={form.formState.errors.billingAddress?.city?.message}
                      >
                        {(aria) => (
                          <Input
                            {...aria}
                            autoComplete="billing address-level2"
                            {...form.register("billingAddress.city")}
                          />
                        )}
                      </FormField>
                      <FormField
                        id="billing-state"
                        label={billingCountryMeta?.stateLabel ?? t.address.state}
                        required
                        error={form.formState.errors.billingAddress?.state?.message}
                      >
                        {(aria) => (
                          <Controller
                            control={form.control}
                            name="billingAddress.state"
                            render={({ field }) => (
                              <StateRegionField
                                id={aria.id}
                                country={watchedBillingCountry ?? bootstrap.settings.defaultCountry}
                                value={field.value ?? ""}
                                autoComplete="billing address-level1"
                                required
                                ariaDescribedBy={aria["aria-describedby"]}
                                ariaInvalid={Boolean(form.formState.errors.billingAddress?.state)}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                              />
                            )}
                          />
                        )}
                      </FormField>
                      <FormField
                        id="billing-postal"
                        label={t.address.billingPostal}
                        required
                        hint={
                          billingCountryMeta
                            ? fill(t.address.postalHint, {
                                example: billingCountryMeta.postalExample,
                              })
                            : undefined
                        }
                        error={form.formState.errors.billingAddress?.postalCode?.message}
                      >
                        {(aria) => (
                          <Input
                            {...aria}
                            autoComplete="billing postal-code"
                            {...form.register("billingAddress.postalCode")}
                          />
                        )}
                      </FormField>
                    </div>
                  )}
                </section>

                {/* 3. Insured Courier Method & Presentation Notes */}
                <section className="border-b border-border pb-6 last:border-b-0 sm:rounded-xl sm:border sm:bg-card sm:p-5 sm:shadow-sm md:p-6">
                  <div className="border-b border-border pb-4">
                    <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground sm:text-xl">
                      {t.shippingMethod.heading}
                    </h2>
                  </div>

                  {quoteError && (
                    <p
                      role="alert"
                      className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                    >
                      {quoteError}
                    </p>
                  )}

                  {quote && quote.availableZones.length > 0 && (
                    <div
                      className="mt-4 space-y-2.5"
                      role="radiogroup"
                      aria-label={t.shippingMethod.ariaLabel}
                    >
                      {quote.availableZones.map((zone) => {
                        const selected = (watchedZoneId ?? quote.selectedZone.id) === zone.id;
                        return (
                          <button
                            key={zone.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => void updateQuote(watchedCountry, zone.id)}
                            className={`flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 rounded-md border p-4 text-left transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-accent ${
                              selected
                                ? "border-accent bg-accent-tint ring-1 ring-accent"
                                : "border-border bg-surface hover:border-border-strong"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Truck
                                  className="size-5 shrink-0 stroke-[1.5] text-accent-text"
                                  aria-hidden="true"
                                />
                                <span className="font-semibold text-foreground">{zone.name}</span>
                                {zone.isInsured && (
                                  <Badge variant="outline">{t.shippingMethod.insured}</Badge>
                                )}
                              </div>
                              <p className="tabular-nums-price text-xs text-muted-foreground">
                                {fill(t.shippingMethod.dispatchWindow, {
                                  min: zone.estimatedDaysMin,
                                  max: zone.estimatedDaysMax,
                                })}
                              </p>
                            </div>
                            <span className="tabular-nums-price shrink-0 text-sm font-semibold text-foreground">
                              {zone.isFreeShipping
                                ? t.shippingMethod.complimentary
                                : activeQuote
                                  ? formatMoneyExact(
                                      zone.effectiveRate,
                                      displayCurrency,
                                      "en-US",
                                      displayDecimals,
                                    )
                                  : formatPrice(zone.baseEffectiveRate, { exact: true })}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <details
                    className="group mt-4"
                    open={
                      Boolean(
                        form.formState.errors.giftNote || form.formState.errors.customerNote,
                      ) || undefined
                    }
                  >
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-accent-text underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">{t.shippingMethod.showNotes}</span>
                      <span className="hidden group-open:inline">{t.shippingMethod.hideNotes}</span>
                    </summary>
                    <div className="mt-2 grid gap-4 sm:grid-cols-2">
                      <FormField
                        id="checkout-gift-note"
                        label={t.shippingMethod.giftNote}
                        error={form.formState.errors.giftNote?.message}
                      >
                        {(aria) => (
                          <Textarea
                            {...aria}
                            rows={2}
                            placeholder={t.shippingMethod.giftNotePlaceholder}
                            {...form.register("giftNote")}
                          />
                        )}
                      </FormField>
                      <FormField
                        id="checkout-customer-note"
                        label={t.shippingMethod.instructions}
                        error={form.formState.errors.customerNote?.message}
                      >
                        {(aria) => (
                          <Textarea
                            {...aria}
                            rows={2}
                            placeholder={t.shippingMethod.instructionsPlaceholder}
                            {...form.register("customerNote")}
                          />
                        )}
                      </FormField>
                    </div>
                  </details>
                </section>

                {/* 4. Review & Reserve Inventory */}
                <section className="border-b border-border pb-6 last:border-b-0 sm:rounded-xl sm:border sm:bg-card sm:p-5 sm:shadow-sm md:p-6">
                  <div className="hidden border-b border-border pb-4 sm:block">
                    <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground sm:text-xl">
                      {t.reserve.heading}
                    </h2>
                  </div>

                  <div
                    role="note"
                    className="flex items-start gap-2 rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground sm:mt-4 sm:gap-2.5 sm:border sm:border-border sm:p-4 sm:text-sm"
                  >
                    <ShieldCheck
                      className="mt-0.5 size-4 shrink-0 stroke-[1.5] text-accent-text sm:size-5"
                      aria-hidden="true"
                    />
                    <span>{t.reserve.holdNote}</span>
                  </div>

                  <div className="mt-5 hidden sm:block">
                    <Button
                      type="submit"
                      size="lg"
                      className="tabular-nums-price w-full"
                      disabled={form.formState.isSubmitting || Boolean(quoteError) || isQuoting}
                    >
                      <Lock className="size-5 stroke-[1.5]" aria-hidden="true" />
                      <span>
                        {form.formState.isSubmitting
                          ? t.reserve.placing
                          : fill(t.reserve.button, {
                              amount: fmtSummaryAmount(displayTotal, true),
                            })}
                      </span>
                    </Button>
                  </div>
                </section>
              </m.form>
            ) : (
              /* Phase B: Active Payment Authorization Panel (after atomic reservation or retry link) */
              <m.section
                key="checkout-phase-payment"
                custom={1}
                variants={reducedMotion ? fadeInVariants : slideStepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-5 rounded-xl border border-accent bg-surface p-4 shadow-sm md:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-[-0.015em] text-foreground sm:text-2xl">
                      {createdOrder
                        ? fill(t.payment.orderHeading, { orderNumber: createdOrder.orderNumber })
                        : fill(t.payment.orderHeading, {
                            orderNumber: initialRetryOrder?.order.orderNumber ?? "",
                          })}
                    </h2>
                  </div>
                  <Badge variant="warning">{t.payment.holdBadge}</Badge>
                </div>

                {createdOrder?.reservedUntil &&
                  reservationMsLeft !== null &&
                  !reservationExpired && (
                    <div
                      className={cn(
                        "flex items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-xs leading-relaxed sm:px-4 sm:py-3",
                        reservationMsLeft < 5 * 60_000
                          ? "border-warning/40 bg-warning/10 text-foreground"
                          : "border-border bg-surface-2 text-muted-foreground",
                      )}
                    >
                      <Clock
                        className="size-4 shrink-0 stroke-[1.5] text-accent-text sm:size-5"
                        aria-hidden="true"
                      />
                      <span>
                        {t.payment.heldFor}{" "}
                        <strong
                          className="tabular-nums-price font-semibold text-foreground"
                          aria-live="off"
                        >
                          {formatCountdown(reservationMsLeft)}
                        </strong>
                        {t.payment.heldForAfter}
                      </span>
                    </div>
                  )}

                {reservationExpired ? (
                  <div
                    role="alert"
                    className="space-y-3 rounded-md border border-border bg-surface-2 p-4 text-sm"
                  >
                    <p className="font-medium text-foreground">{t.payment.expiredTitle}</p>
                    <p className="text-muted-foreground">
                      {fill(t.payment.expiredText, {
                        orderNumber: createdOrder?.orderNumber ?? "",
                      })}
                    </p>
                    <Button asChild size="md" className="w-full sm:w-auto">
                      <Link href="/collections">{t.payment.continueShopping}</Link>
                    </Button>
                  </div>
                ) : null}

                <AnimatePresence initial={false}>
                  {paymentFailureNotice ? (
                    <m.div
                      key={paymentFailureNotice}
                      variants={fadeInVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      role="alert"
                      className="ma-error-shake flex items-start gap-2.5 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
                    >
                      <AlertCircle
                        className="mt-0.5 size-5 shrink-0 stroke-[1.5]"
                        aria-hidden="true"
                      />
                      <span>{paymentFailureNotice}</span>
                    </m.div>
                  ) : null}
                </AnimatePresence>

                {reservationExpired ? null : !createdOrder ? (
                  <p className="text-sm text-muted-foreground">{t.payment.initializing}</p>
                ) : createdOrder.payment.mode === "sandbox" ? (
                  <div className="space-y-4 rounded-md border border-border bg-background p-5">
                    <div className="flex items-center gap-2.5">
                      <Sparkles
                        className="size-5 stroke-[1.5] text-accent-text"
                        aria-hidden="true"
                      />
                      <h3 className="text-base font-semibold text-foreground">
                        {createdOrder.payment.provider === "RAZORPAY"
                          ? t.payment.razorpaySandbox
                          : t.payment.stripeSandbox}
                      </h3>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {fill(t.payment.sandboxText, {
                        intentId: createdOrder.payment.providerIntentId,
                      })}
                    </p>

                    {createdOrder.status === "PAYMENT_FAILED" ? (
                      <Button
                        type="button"
                        size="lg"
                        className="w-full"
                        disabled={sandboxBusy}
                        onClick={handleRetryOrderPayment}
                      >
                        {sandboxBusy ? t.payment.preparingRetry : t.payment.retry}
                      </Button>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          type="button"
                          size="lg"
                          className="tabular-nums-price flex-1"
                          disabled={sandboxBusy}
                          onClick={() => handleSandboxOutcome("succeed")}
                        >
                          <CheckCircle2 className="size-5 stroke-[1.5]" aria-hidden="true" />
                          <span>
                            {sandboxBusy
                              ? t.payment.authorizing
                              : fill(t.payment.authorizeComplete, { amount: chargedLabel })}
                          </span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          disabled={sandboxBusy}
                          onClick={() => handleSandboxOutcome("fail")}
                        >
                          {t.payment.simulateDecline}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : createdOrder.payment.provider === "STRIPE" &&
                  createdOrder.payment.clientSecret &&
                  createdOrder.payment.keyId ? (
                  <StripePaymentBox
                    publishableKey={createdOrder.payment.keyId}
                    clientSecret={createdOrder.payment.clientSecret}
                    orderNumber={createdOrder.orderNumber}
                    guestToken={createdOrder.guestToken}
                    total={createdOrder.chargedAmount}
                    currency={createdOrder.chargedCurrency}
                  />
                ) : createdOrder.payment.provider === "RAZORPAY" ? (
                  <div className="space-y-4">
                    <p className="tabular-nums-price text-sm text-muted-foreground">
                      {fill(t.payment.razorpayText, { amount: chargedLabel })}
                    </p>
                    <Button
                      type="button"
                      size="lg"
                      className="tabular-nums-price w-full"
                      onClick={handleOpenRazorpayModal}
                    >
                      <Lock className="size-5 stroke-[1.5]" aria-hidden="true" />
                      <span>{fill(t.payment.razorpayButton, { amount: chargedLabel })}</span>
                    </Button>
                  </div>
                ) : (
                  <p role="alert" className="text-sm text-destructive">
                    {t.payment.keysMissing}
                  </p>
                )}
              </m.section>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky Order Summary Sidebar (>= 1024px) */}
        <aside className="hidden min-w-0 lg:col-span-5 lg:block">
          <div className="rounded-xl border border-border bg-surface p-6 shadow-sm lg:sticky lg:top-24">
            <h2 className="mb-4 text-xl font-semibold tracking-[-0.015em] text-text">
              {t.summary.heading}
            </h2>
            {orderSummaryContent}
          </div>
        </aside>
      </div>

      {/* Full-Width Sticky Bottom CTA Bar (< 640px Mobile Phase A) */}
      {!isPaymentPhase && !keyboardOpen && (
        <div
          data-sticky-cta="true"
          className="safe-area-pb fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-border bg-header-bg p-4 shadow-md backdrop-blur-md sm:hidden"
        >
          <Button
            type="submit"
            form="checkout-form"
            size="lg"
            className="tabular-nums-price w-full"
            disabled={form.formState.isSubmitting || Boolean(quoteError) || isQuoting}
          >
            <Lock className="size-5 shrink-0 stroke-[1.5]" aria-hidden="true" />
            {form.formState.isSubmitting ? (
              <span className="truncate">{t.reserve.placing}</span>
            ) : (
              <>
                <span className="truncate">{t.reserve.mobileButton}</span>
                <span className="ml-auto shrink-0 pl-2">
                  {fmtSummaryAmount(displayTotal, true)}
                </span>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Milliseconds left until `until` (ticks every second), or null without a deadline. */
function useReservationCountdown(until: string | null): number | null {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);
  if (!until) return null;
  return Math.max(0, new Date(until).getTime() - now);
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
