"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
} from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { StripePaymentBox } from "@/components/storefront/StripePaymentBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCountryName } from "@/lib/countries";
import { formatMoneyExact } from "@/lib/money";
import type { CheckoutQuoteDTO } from "@/modules/orders/checkout-quote";
import {
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
  Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
}

interface CheckoutClientProps {
  bootstrap: CheckoutBootstrapDTO;
  initialRetryOrder?: {
    order: OrderConfirmationDTO;
    guestToken: string | null;
  } | null;
}

export function CheckoutClient({ bootstrap, initialRetryOrder = null }: CheckoutClientProps) {
  const router = useRouter();
  const [quote, setQuote] = React.useState<CheckoutQuoteDTO | null>(bootstrap.initialQuote);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [isQuoting, setIsQuoting] = React.useState(false);

  const [createdOrder, setCreatedOrder] = React.useState<CreatedOrderResultDTO | null>(null);
  const [paymentFailureNotice, setPaymentFailureNotice] = React.useState<string | null>(
    initialRetryOrder?.order.status === "PAYMENT_FAILED"
      ? "The previous authorization attempt did not complete. Retry payment below while your 30-minute vault hold remains active."
      : null,
  );
  const [sandboxBusy, setSandboxBusy] = React.useState(false);

  const [idempotencyKey] = React.useState<string>(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `chk_${Date.now().toString(36)}`,
  );

  const defaultAddr: SavedAddressDTO | undefined = bootstrap.savedAddresses[0];
  const initialCountry = defaultAddr?.country ?? bootstrap.settings.defaultCountry ?? "US";

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

  const watchedCountry = useWatch({ control: form.control, name: "shippingAddress.country" });
  const watchedZoneId = useWatch({ control: form.control, name: "shippingZoneId" });
  const watchedBillingSame = useWatch({ control: form.control, name: "billingSameAsShipping" });

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
    async (country: string, zoneId?: string | null) => {
      if (!country || country.length !== 2 || bootstrap.cart.items.length === 0) return;
      setIsQuoting(true);
      setQuoteError(null);
      const res = await quoteCheckoutAction({
        shippingCountry: country,
        shippingZoneId: zoneId ?? null,
      });
      setIsQuoting(false);
      if (!res.ok) {
        setQuoteError(res.error.message);
        return;
      }
      setQuote(res.data);
      form.setValue("shippingZoneId", res.data.selectedZone.id);
    },
    [bootstrap.cart.items.length, form],
  );

  function handleSelectSavedAddress(addr: SavedAddressDTO) {
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

  const onCreateOrder = form.handleSubmit(async (rawValues) => {
    const values = rawValues as CreateCheckoutOrderInput;
    setPaymentFailureNotice(null);

    const res = await createCheckoutOrderAction({
      ...values,
      idempotencyKey,
    });

    if (!res.ok) {
      if (res.error.fieldErrors) {
        for (const messages of Object.values(res.error.fieldErrors)) {
          if (messages[0]) {
            toast.error(messages[0]);
            break;
          }
        }
      } else {
        toast.error(res.error.message);
      }
      return;
    }

    visitorStore.setBagCount(0);
    setCreatedOrder(res.data);
    toast.success(`Order ${res.data.orderNumber} reserved cleanly in our vault.`);
  });

  async function handleRetryOrderPayment() {
    if (!createdOrder) return;
    setSandboxBusy(true);
    setPaymentFailureNotice(null);
    const res = await retryOrderPaymentAction({
      orderNumber: createdOrder.orderNumber,
      guestToken: createdOrder.guestToken,
    });
    setSandboxBusy(false);

    if (!res.ok) {
      toast.error(res.error.message);
      setPaymentFailureNotice(res.error.message);
      return;
    }

    setCreatedOrder(res.data);
    toast.info("New authorization session initialized.");
  }

  async function handleSandboxOutcome(outcome: "succeed" | "fail") {
    if (!createdOrder) return;
    setSandboxBusy(true);
    setPaymentFailureNotice(null);

    const res = await confirmSandboxPaymentAction({
      orderNumber: createdOrder.orderNumber,
      outcome,
      guestToken: createdOrder.guestToken,
    });
    setSandboxBusy(false);

    if (!res.ok) {
      toast.error(res.error.message);
      setPaymentFailureNotice(res.error.message);
      return;
    }

    if (res.data.status === "PAID") {
      toast.success(`Payment settled for ${res.data.orderNumber}.`);
      const tokenQuery = createdOrder.guestToken
        ? `?token=${encodeURIComponent(createdOrder.guestToken)}`
        : "";
      router.push(`/orders/${encodeURIComponent(res.data.orderNumber)}/confirmation${tokenQuery}`);
      return;
    }

    setCreatedOrder({ ...createdOrder, status: res.data.status });
    setPaymentFailureNotice(
      "Card authorization was declined in sandbox. Your 30-minute vault hold remains active—retry payment below.",
    );
    toast.error("Card authorization declined.");
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
        script.onerror = () => reject(new Error("Unable to load Razorpay gateway script."));
        document.body.appendChild(script);
      });
    }

    const styles = getComputedStyle(document.documentElement);
    const accentColor = styles.getPropertyValue("--accent").trim();
    const tokenQuery = createdOrder.guestToken
      ? `?token=${encodeURIComponent(createdOrder.guestToken)}`
      : "";

    const instance = new win.Razorpay!({
      key: createdOrder.payment.keyId,
      order_id: createdOrder.payment.razorpayOrderId,
      name: bootstrap.settings.storeName,
      description: `Order ${createdOrder.orderNumber}`,
      prefill: {
        email: form.getValues("email") || initialRetryOrder?.order.shippingAddress.fullName,
      },
      theme: accentColor ? { color: accentColor } : undefined,
      handler: () => {
        router.push(
          `/orders/${encodeURIComponent(createdOrder.orderNumber)}/confirmation${tokenQuery}`,
        );
      },
    });
    instance.open();
  }

  if (bootstrap.cart.items.length === 0 && !createdOrder && !initialRetryOrder) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your Shopping Bag Is Empty"
        description="Add a creation to your shopping bag before starting an insured checkout."
        actionLabel="Explore Collections"
        actionHref="/collections"
      />
    );
  }

  const displayCurrency = createdOrder?.currency ?? bootstrap.cart.currency;
  const displaySubtotal = createdOrder?.subtotal ?? quote?.subtotal ?? bootstrap.cart.subtotal;
  const displayShipping = createdOrder?.shippingCost ?? quote?.shippingCost ?? null;
  const displayTax = createdOrder?.taxAmount ?? quote?.taxAmount ?? null;
  const displayTotal = createdOrder?.total ?? quote?.total ?? bootstrap.cart.subtotal;

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        {/* Phase A: Contact, Addresses & Shipping Selection */}
        {!createdOrder && !initialRetryOrder ? (
          <form onSubmit={onCreateOrder} className="space-y-6" noValidate>
            {/* 1. Contact */}
            <section className="rounded-md border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                <div>
                  <p className="font-sans text-editorial-label text-accent-text">Step 1 of 4</p>
                  <h2 className="font-display text-2xl font-medium text-foreground">
                    Patron Contact
                  </h2>
                </div>
                {!bootstrap.userEmail && (
                  <p className="text-xs text-muted-foreground">
                    Have an account?{" "}
                    <Link
                      href="/login?next=/checkout"
                      className="text-accent-text underline underline-offset-4"
                    >
                      Sign in
                    </Link>
                  </p>
                )}
              </div>

              <div className="mt-4">
                <FormField
                  id="checkout-email"
                  label="Email Address"
                  required
                  hint="Order confirmation, GIA grading documents, and courier tracking are sent here."
                  error={form.formState.errors.email?.message}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      {...form.register("email")}
                    />
                  )}
                </FormField>
              </div>
            </section>

            {/* 2. Shipping & Billing Address */}
            <section className="rounded-md border border-border bg-card p-6">
              <div className="border-b border-border pb-4">
                <p className="font-sans text-editorial-label text-accent-text">Step 2 of 4</p>
                <h2 className="font-display text-2xl font-medium text-foreground">
                  Insured Delivery Destination
                </h2>
              </div>

              {bootstrap.savedAddresses.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Saved Account Addresses
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {bootstrap.savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => handleSelectSavedAddress(addr)}
                        className="cursor-pointer rounded-sm border border-border bg-background px-3 py-2 text-left text-xs transition-colors hover:border-accent"
                      >
                        <span className="block font-medium text-foreground">
                          {addr.label ? `${addr.label} — ` : ""}
                          {addr.fullName}
                        </span>
                        <span className="block text-muted-foreground">
                          {addr.line1}, {addr.city} ({addr.country})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FormField
                  id="shipping-full-name"
                  label="Recipient Full Name"
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
                  id="shipping-phone"
                  label="Courier Contact Phone"
                  required
                  hint="Required for insured adult signature scheduling"
                  error={form.formState.errors.shippingAddress?.phone?.message}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      type="tel"
                      autoComplete="shipping tel"
                      {...form.register("shippingAddress.phone")}
                    />
                  )}
                </FormField>

                <div className="sm:col-span-2">
                  <FormField
                    id="shipping-line1"
                    label="Street Address"
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

                <div className="sm:col-span-2">
                  <FormField
                    id="shipping-line2"
                    label="Apartment, Suite, or Floor (Optional)"
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

                <FormField
                  id="shipping-city"
                  label="City"
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
                  id="shipping-state"
                  label="State / Province"
                  required
                  error={form.formState.errors.shippingAddress?.state?.message}
                >
                  {(aria) => (
                    <Input
                      {...aria}
                      autoComplete="shipping address-level1"
                      {...form.register("shippingAddress.state")}
                    />
                  )}
                </FormField>

                <FormField
                  id="shipping-postal"
                  label="Postal / ZIP Code"
                  required
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

                <FormField
                  id="shipping-country"
                  label="Country"
                  required
                  error={form.formState.errors.shippingAddress?.country?.message}
                >
                  {(aria) => (
                    <Controller
                      control={form.control}
                      name="shippingAddress.country"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={(nextCountry) => {
                            field.onChange(nextCountry);
                            void updateQuote(nextCountry, null);
                          }}
                        >
                          <SelectTrigger
                            id={aria.id}
                            aria-describedby={aria["aria-describedby"]}
                            className="bg-background"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {bootstrap.settings.supportedCountries.map((code) => (
                              <SelectItem key={code} value={code}>
                                {formatCountryName(code)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}
                </FormField>
              </div>

              <div className="mt-5 space-y-3 border-t border-border pt-4">
                {bootstrap.userEmail && (
                  <div className="flex items-center gap-2.5 text-sm text-foreground">
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
                    <label htmlFor="checkout-save-address" className="cursor-pointer">
                      Save this shipping address to my patron address book
                    </label>
                  </div>
                )}

                <div className="flex items-center gap-2.5 text-sm text-foreground">
                  <Checkbox
                    id="checkout-billing-same"
                    checked={Boolean(watchedBillingSame)}
                    onCheckedChange={(v) => handleBillingToggle(Boolean(v))}
                  />
                  <label htmlFor="checkout-billing-same" className="cursor-pointer">
                    Billing address matches my shipping address
                  </label>
                </div>
              </div>

              {!watchedBillingSame && (
                <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                  <p className="text-sm font-medium text-foreground sm:col-span-2">
                    Billing Address
                  </p>
                  <FormField
                    id="billing-full-name"
                    label="Full Name"
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
                    id="billing-phone"
                    label="Phone"
                    required
                    error={form.formState.errors.billingAddress?.phone?.message}
                  >
                    {(aria) => (
                      <Input
                        {...aria}
                        type="tel"
                        autoComplete="billing tel"
                        {...form.register("billingAddress.phone")}
                      />
                    )}
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField
                      id="billing-line1"
                      label="Street Address"
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
                    label="City"
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
                    label="State / Province"
                    required
                    error={form.formState.errors.billingAddress?.state?.message}
                  >
                    {(aria) => (
                      <Input
                        {...aria}
                        autoComplete="billing address-level1"
                        {...form.register("billingAddress.state")}
                      />
                    )}
                  </FormField>
                  <FormField
                    id="billing-postal"
                    label="Postal Code"
                    required
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
                  <FormField
                    id="billing-country"
                    label="Country"
                    required
                    error={form.formState.errors.billingAddress?.country?.message}
                  >
                    {(aria) => (
                      <Controller
                        control={form.control}
                        name="billingAddress.country"
                        render={({ field }) => (
                          <Select
                            value={field.value ?? bootstrap.settings.defaultCountry}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger id={aria.id} className="bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {bootstrap.settings.supportedCountries.map((code) => (
                                <SelectItem key={code} value={code}>
                                  {formatCountryName(code)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    )}
                  </FormField>
                </div>
              )}
            </section>

            {/* 3. Insured Courier Method & Presentation Notes */}
            <section className="rounded-md border border-border bg-card p-6">
              <div className="border-b border-border pb-4">
                <p className="font-sans text-editorial-label text-accent-text">Step 3 of 4</p>
                <h2 className="font-display text-2xl font-medium text-foreground">
                  Insured Courier &amp; Presentation
                </h2>
              </div>

              {quoteError && (
                <p
                  role="alert"
                  className="mt-4 rounded-sm border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
                >
                  {quoteError}
                </p>
              )}

              {quote && quote.availableZones.length > 0 && (
                <div className="mt-4 space-y-2.5" role="radiogroup" aria-label="Shipping method">
                  {quote.availableZones.map((zone) => {
                    const selected = (watchedZoneId ?? quote.selectedZone.id) === zone.id;
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => void updateQuote(watchedCountry, zone.id)}
                        className={`flex w-full cursor-pointer items-center justify-between gap-4 rounded-sm border p-4 text-left transition-colors ${
                          selected
                            ? "border-accent bg-muted/40"
                            : "border-border bg-background hover:border-accent/60"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Truck className="size-4 text-accent" aria-hidden="true" />
                            <span className="font-medium text-foreground">{zone.name}</span>
                            {zone.isInsured && <Badge variant="outline">Insured</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Estimated dispatch window: {zone.estimatedDaysMin}–
                            {zone.estimatedDaysMax} business days
                          </p>
                        </div>
                        <span className="font-medium text-foreground tabular-nums-price">
                          {zone.isFreeShipping
                            ? "Complimentary"
                            : formatMoneyExact(zone.effectiveRate, displayCurrency)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <FormField
                  id="checkout-gift-note"
                  label="Complimentary Gift Card Note (Optional)"
                  error={form.formState.errors.giftNote?.message}
                >
                  {(aria) => (
                    <Textarea
                      {...aria}
                      rows={2}
                      placeholder="Calligraphed note sealed with your velvet presentation box"
                      {...form.register("giftNote")}
                    />
                  )}
                </FormField>
                <FormField
                  id="checkout-customer-note"
                  label="Atelier Delivery Instructions (Optional)"
                  error={form.formState.errors.customerNote?.message}
                >
                  {(aria) => (
                    <Textarea
                      {...aria}
                      rows={2}
                      placeholder="Preferred courier reception hours or sizing comments"
                      {...form.register("customerNote")}
                    />
                  )}
                </FormField>
              </div>
            </section>

            {/* 4. Review & Reserve Inventory */}
            <section className="rounded-md border border-border bg-card p-6">
              <div className="border-b border-border pb-4">
                <p className="font-sans text-editorial-label text-accent-text">Step 4 of 4</p>
                <h2 className="font-display text-2xl font-medium text-foreground">
                  Reserve &amp; Proceed to Payment
                </h2>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Placing your order locks vault inventory exclusively for 30 minutes and calculates
                final pricing from verified atelier records before payment authorization.
              </p>

              <div className="mt-5">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={form.formState.isSubmitting || Boolean(quoteError) || isQuoting}
                >
                  <Lock className="size-4" aria-hidden="true" />
                  <span>
                    {form.formState.isSubmitting
                      ? "Reserving Vault Inventory…"
                      : `Reserve & Continue to Payment (${formatMoneyExact(displayTotal, displayCurrency)})`}
                  </span>
                </Button>
              </div>
            </section>
          </form>
        ) : (
          /* Phase B: Active Payment Authorization Panel (after atomic reservation or retry link) */
          <section className="space-y-5 rounded-md border border-accent/40 bg-card p-6 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="font-sans text-editorial-label text-accent-text">
                  Payment Authorization
                </p>
                <h2 className="font-display text-2xl font-medium text-foreground">
                  {createdOrder
                    ? `Order ${createdOrder.orderNumber}`
                    : `Order ${initialRetryOrder?.order.orderNumber}`}
                </h2>
              </div>
              <Badge variant="warning">Vault Hold Active</Badge>
            </div>

            {createdOrder?.reservedUntil && (
              <div className="flex items-center gap-2 rounded-sm border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
                <Clock className="size-4 shrink-0 text-accent" aria-hidden="true" />
                <span>
                  Vault stock reserved until{" "}
                  <strong className="text-foreground">
                    {new Date(createdOrder.reservedUntil).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                  . Complete authorization before expiry.
                </span>
              </div>
            )}

            {paymentFailureNotice && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-sm border border-destructive/40 bg-destructive/10 p-3.5 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{paymentFailureNotice}</span>
              </div>
            )}

            {!createdOrder ? (
              <p className="text-sm text-muted-foreground">
                Initializing payment authorization session…
              </p>
            ) : createdOrder.payment.mode === "sandbox" ? (
              <div className="space-y-4 rounded-sm border border-border bg-background p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-accent" aria-hidden="true" />
                  <h3 className="font-medium text-foreground">
                    {createdOrder.payment.provider === "RAZORPAY"
                      ? "Razorpay Test Sandbox"
                      : "Stripe Test Sandbox"}
                  </h3>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Running in provider sandbox mode ({createdOrder.payment.providerIntentId}). Choose
                  an outcome to exercise signed webhook verification, stock settlement, and
                  confirmation dispatch.
                </p>

                {createdOrder.status === "PAYMENT_FAILED" ? (
                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    disabled={sandboxBusy}
                    onClick={handleRetryOrderPayment}
                  >
                    {sandboxBusy ? "Preparing Retry…" : "Retry Payment Authorization"}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      size="lg"
                      className="flex-1"
                      disabled={sandboxBusy}
                      onClick={() => handleSandboxOutcome("succeed")}
                    >
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                      <span>
                        {sandboxBusy
                          ? "Authorizing…"
                          : `Authorize & Complete Order (${formatMoneyExact(displayTotal, displayCurrency)})`}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      disabled={sandboxBusy}
                      onClick={() => handleSandboxOutcome("fail")}
                    >
                      Simulate Card Decline
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
                total={createdOrder.total}
                currency={createdOrder.currency}
              />
            ) : createdOrder.payment.provider === "RAZORPAY" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Proceed via encrypted Razorpay Checkout to settle{" "}
                  {formatMoneyExact(createdOrder.total, createdOrder.currency)}.
                </p>
                <Button
                  type="button"
                  size="lg"
                  className="w-full"
                  onClick={handleOpenRazorpayModal}
                >
                  <Lock className="size-4" aria-hidden="true" />
                  <span>
                    Pay {formatMoneyExact(createdOrder.total, createdOrder.currency)} with Razorpay
                  </span>
                </Button>
              </div>
            ) : (
              <p role="alert" className="text-sm text-destructive">
                Payment gateway client keys are incomplete. Please verify environment configuration.
              </p>
            )}
          </section>
        )}
      </div>

      {/* Sticky Order Summary Sidebar */}
      <aside className="lg:col-span-5">
        <div className="rounded-md border border-border bg-card p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-2xl font-medium text-foreground">Atelier Summary</h2>

          <ul className="mt-4 divide-y divide-border border-y border-border">
            {(initialRetryOrder?.order.items ?? bootstrap.cart.items).map((item) => {
              const isRetryItem = "titleSnapshot" in item;
              const imgUrl = isRetryItem ? item.imageUrlSnapshot : item.imageUrl;
              const title = isRetryItem ? item.titleSnapshot : item.productName;
              const variantLabel = isRetryItem ? item.variantTitleSnapshot : item.variantTitle;
              return (
                <li key={item.id} className="flex items-center gap-3 py-3.5">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-sm border border-border bg-muted">
                    {imgUrl ? (
                      <Image src={imgUrl} alt={title} fill sizes="64px" className="object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {variantLabel} · Qty {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-foreground tabular-nums-price">
                    {formatMoneyExact(item.lineTotal, displayCurrency)}
                  </p>
                </li>
              );
            })}
          </ul>

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="font-medium text-foreground tabular-nums-price">
                {formatMoneyExact(displaySubtotal, displayCurrency)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {quote?.selectedZone.name ??
                  initialRetryOrder?.order.shippingMethodName ??
                  "Insured Shipping"}
              </dt>
              <dd className="font-medium text-foreground tabular-nums-price">
                {isQuoting
                  ? "Calculating…"
                  : displayShipping === null
                    ? "Select country"
                    : displayShipping === "0.00"
                      ? "Complimentary"
                      : formatMoneyExact(displayShipping, displayCurrency)}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">
                {quote?.taxLabel ?? bootstrap.settings.taxLabel}
                {bootstrap.settings.taxInclusive ? " (Included)" : ""}
              </dt>
              <dd className="font-medium text-foreground tabular-nums-price">
                {displayTax === null ? "—" : formatMoneyExact(displayTax, displayCurrency)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              <dt className="font-display text-lg font-medium text-foreground">Total</dt>
              <dd className="font-display text-2xl font-medium text-foreground tabular-nums-price">
                {formatMoneyExact(displayTotal, displayCurrency)}
              </dd>
            </div>
          </dl>

          {(quote?.signatureRequired ||
            initialRetryOrder?.order.signatureRequired ||
            bootstrap.cart.signatureRequired) && (
            <p className="mt-4 flex items-start gap-2 rounded-sm border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <span>
                Insured hand-delivery with adult signature verification and tamper-evident packaging
                included.
              </span>
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
