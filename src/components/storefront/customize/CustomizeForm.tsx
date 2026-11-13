"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import {
  PrivateImageLightbox,
  type LightboxImageItem,
} from "@/components/shared/PrivateImageLightbox";
import { reconnectRealtimeSocket } from "@/components/providers/useChatRealtime";
import { CustomizeDetailsStep } from "@/components/storefront/customize/CustomizeDetailsStep";
import { CustomizeHeader } from "@/components/storefront/customize/CustomizeHeader";
import { CustomizeProgress } from "@/components/storefront/customize/CustomizeProgress";
import { CustomizeSuccessState } from "@/components/storefront/customize/CustomizeSuccessState";
import { OptionGroup } from "@/components/storefront/customize/OptionGroup";
import { StickyActionBar } from "@/components/storefront/customize/StickyActionBar";
import { SummaryPanel } from "@/components/storefront/customize/SummaryPanel";
import {
  buildInitialInputs,
  estimateIndicativeRange,
  type ContactUiChoice,
  type CustomizeStep,
  type PendingCustomizationUpload,
  type UploadedCustomizationImageItem,
} from "@/components/storefront/customize/types";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes";
import { uploadPrivateCustomerImage } from "@/lib/image-client-compress";
import { useReducedMotionSafe } from "@/lib/motion";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  createCustomizationRequestAction,
  editCustomizationRequestAction,
  sendGuestCustomizationOtpAction,
  verifyGuestCustomizationOtpAction,
} from "@/modules/customization/customization.actions";
import type {
  CustomizationRequestDetailDTO,
  ProductCustomizationSchemaDTO,
} from "@/modules/customization/customization.service";
import {
  isCustomizationGroupApplicable,
  type SubmittedGroupInput,
} from "@/modules/customization/customization.validation";

export interface CustomizeFormProps {
  schema: ProductCustomizationSchemaDTO;
  initialRequest?: CustomizationRequestDetailDTO;
  mode?: "create" | "edit";
  variant?: "page" | "drawer";
  hideHeader?: boolean;
  onSuccess?: (detail: CustomizationRequestDetailDTO) => void;
  onCancel?: () => void;
  onOpenFullPage?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const CONTACT_FIELD_KEYS = new Set(["customerName", "customerEmail", "customerPhone"]);

function isDesktopPageViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

export function CustomizeForm({
  schema,
  initialRequest,
  mode = "create",
  variant = "page",
  hideHeader = false,
  onSuccess,
  onCancel,
  onOpenFullPage,
  onDirtyChange,
}: CustomizeFormProps) {
  const router = useRouter();
  const baseUid = React.useId();
  const reducedMotion = useReducedMotionSafe();

  const initialInputsSnapshot = React.useMemo(
    () => buildInitialInputs(schema, initialRequest),
    [schema, initialRequest],
  );
  const initialImagesSnapshot = React.useMemo<UploadedCustomizationImageItem[]>(
    () =>
      (initialRequest?.images ?? []).map((img) => ({
        storageKey: img.storageKey,
        url: img.url,
        thumbUrl: img.thumbUrl,
        mimeType: img.mimeType,
        sizeBytes: img.sizeBytes,
        width: img.width,
        height: img.height,
        originalName: img.originalName,
      })),
    [initialRequest],
  );

  const [step, setStep] = React.useState<CustomizeStep>(1);
  const [inputs, setInputs] =
    React.useState<Record<string, SubmittedGroupInput>>(initialInputsSnapshot);
  const [images, setImages] =
    React.useState<UploadedCustomizationImageItem[]>(initialImagesSnapshot);
  const [pendingUploads, setPendingUploads] = React.useState<PendingCustomizationUpload[]>([]);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const [customerName, setCustomerName] = React.useState(initialRequest?.customerName ?? "");
  const [customerEmail, setCustomerEmail] = React.useState(initialRequest?.customerEmail ?? "");
  const [customerPhone, setCustomerPhone] = React.useState(initialRequest?.customerPhone ?? "");
  const [contactUiChoice, setContactUiChoice] = React.useState<ContactUiChoice>(
    initialRequest?.contactPreference ?? "EMAIL",
  );
  const [preferredTimeline, setPreferredTimeline] = React.useState(
    initialRequest?.preferredTimeline ?? "",
  );
  const [preferredDate, setPreferredDate] = React.useState(
    initialRequest?.preferredDate ? initialRequest.preferredDate.slice(0, 10) : "",
  );
  const [customerNote, setCustomerNote] = React.useState(initialRequest?.customerNote ?? "");

  const [signedInUser, setSignedInUser] = React.useState(false);
  const [userEditedIdentity, setUserEditedIdentity] = React.useState(false);
  const [otpSentTo, setOtpSentTo] = React.useState<string | null>(null);
  const [otpCode, setOtpCode] = React.useState("");
  const [otpVerifiedEmail, setOtpVerifiedEmail] = React.useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = React.useState(false);
  const [verifyingOtp, setVerifyingOtp] = React.useState(false);

  const [submitting, setSubmitting] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submittedDetail, setSubmittedDetail] =
    React.useState<CustomizationRequestDetailDTO | null>(null);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  const formRef = React.useRef<HTMLFormElement>(null);
  const drawerScrollRef = React.useRef<HTMLDivElement>(null);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const errorSummaryRef = React.useRef<HTMLDivElement>(null);
  const previewUrlsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    const urls = previewUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    fetch("/api/chat/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!active || !json?.ok || !json.data) return;
        if (json.data.userId) {
          setSignedInUser(true);
          if (!initialRequest && json.data.userName && json.data.userName !== "Guest") {
            setCustomerName((prev) => prev || String(json.data.userName));
          }
          if (!initialRequest && json.data.userEmail) {
            setCustomerEmail((prev) => prev || String(json.data.userEmail));
          }
        }
      })
      .catch(() => {
        // Silent prefill failure falls back cleanly to manual inputs
      });
    return () => {
      active = false;
    };
  }, [initialRequest]);

  const visibleGroups = React.useMemo(() => {
    return [...schema.groups]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((group) =>
        isCustomizationGroupApplicable(
          group,
          {
            basePriceBase: schema.productBasePriceBase,
            categorySlug: schema.categorySlug,
            categoryName: schema.categoryName,
            productHasStone: schema.productHasStone,
          },
          inputs,
        ),
      );
  }, [schema, inputs]);

  const indicative = React.useMemo(() => estimateIndicativeRange(schema, inputs), [schema, inputs]);

  const activeUploadingCount = React.useMemo(
    () => pendingUploads.filter((p) => p.status === "uploading").length,
    [pendingUploads],
  );

  const isDirty = React.useMemo(() => {
    if (submittedDetail) return false;
    const inputsChanged = JSON.stringify(inputs) !== JSON.stringify(initialInputsSnapshot);
    const imagesChanged =
      images.length !== initialImagesSnapshot.length ||
      images.some((img, i) => img.storageKey !== initialImagesSnapshot[i]?.storageKey) ||
      activeUploadingCount > 0;
    const contactPrefBase = initialRequest?.contactPreference ?? "EMAIL";
    const apiContactPreference = contactUiChoice === "PHONE" ? "PHONE" : "EMAIL";
    const detailsChanged =
      apiContactPreference !== contactPrefBase ||
      customerPhone.trim() !== (initialRequest?.customerPhone ?? "") ||
      preferredTimeline.trim() !== (initialRequest?.preferredTimeline ?? "") ||
      preferredDate.trim() !== (initialRequest?.preferredDate?.slice(0, 10) ?? "") ||
      customerNote.trim() !== (initialRequest?.customerNote ?? "") ||
      userEditedIdentity;

    return inputsChanged || imagesChanged || detailsChanged;
  }, [
    submittedDetail,
    inputs,
    initialInputsSnapshot,
    images,
    initialImagesSnapshot,
    activeUploadingCount,
    contactUiChoice,
    customerPhone,
    preferredTimeline,
    preferredDate,
    customerNote,
    userEditedIdentity,
    initialRequest,
  ]);

  React.useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const unsavedGuard = useUnsavedChangesGuard({
    isDirty: variant === "page" && isDirty,
    title: "Discard customization?",
    description: "You have unsaved customization selections. Leaving now will discard them.",
  });

  const lightboxImages: LightboxImageItem[] = React.useMemo(
    () =>
      images.map((img, idx) => ({
        url: img.url,
        alt: img.originalName ?? `Reference image ${idx + 1}`,
      })),
    [images],
  );

  function clearFieldError(key: string) {
    setSubmitError(null);
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }

  function updateGroupInput(groupCode: string, next: SubmittedGroupInput) {
    setInputs((prev) => ({
      ...prev,
      [groupCode]: next,
    }));
    clearFieldError(groupCode);
  }

  function scrollTopForStepChange() {
    if (variant === "drawer") {
      drawerScrollRef.current?.scrollTo({
        top: 0,
        behavior: reducedMotion ? "auto" : "smooth",
      });
      return;
    }
    window.scrollTo({
      top: 0,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }

  function handleStepSelect(targetStep: CustomizeStep) {
    setStep(targetStep);
    window.requestAnimationFrame(() => scrollTopForStepChange());
  }

  function focusTargetElement(fieldKey: string) {
    const attemptFocus = () => {
      const root = formRef.current;
      if (!root) return false;

      if (CONTACT_FIELD_KEYS.has(fieldKey)) {
        const inputEl = root.querySelector<HTMLElement>(`#${CSS.escape(`${baseUid}-${fieldKey}`)}`);
        if (!inputEl) return false;
        inputEl.scrollIntoView({
          block: "center",
          behavior: reducedMotion ? "auto" : "smooth",
        });
        inputEl.focus({ preventScroll: true });
        return true;
      }

      const groupEl = root.querySelector<HTMLElement>(
        `[data-group-code="${CSS.escape(fieldKey)}"]`,
      );
      if (!groupEl) return false;
      groupEl.scrollIntoView({
        block: "center",
        behavior: reducedMotion ? "auto" : "smooth",
      });
      const focusable = groupEl.querySelector<HTMLElement>(
        "input:not([type='file']):not([disabled]), textarea:not([disabled]), button:not([disabled]), [role='slider']",
      );
      focusable?.focus({ preventScroll: true });
      return true;
    };

    window.requestAnimationFrame(() => {
      if (!attemptFocus()) {
        window.requestAnimationFrame(() => {
          attemptFocus();
        });
      }
    });
  }

  function jumpToField(fieldKey: string) {
    const isDesktopPage = variant === "page" && isDesktopPageViewport();
    if (!isDesktopPage) {
      setStep(CONTACT_FIELD_KEYS.has(fieldKey) ? 2 : 1);
    }
    focusTargetElement(fieldKey);
  }

  async function uploadSingleFile(localId: string, file: File) {
    try {
      const uploaded = await uploadPrivateCustomerImage({
        file,
        endpointPrefix: "/api/customizations/uploads",
        onProgress: (pct) => {
          setPendingUploads((prev) =>
            prev.map((item) => (item.localId === localId ? { ...item, progress: pct } : item)),
          );
        },
      });

      setPendingUploads((prev) => {
        const found = prev.find((p) => p.localId === localId);
        if (found) {
          previewUrlsRef.current.delete(found.previewUrl);
          URL.revokeObjectURL(found.previewUrl);
        }
        return prev.filter((p) => p.localId !== localId);
      });

      setImages((prev) => [
        ...prev,
        {
          storageKey: uploaded.storageKey,
          thumbKey: uploaded.thumbKey,
          url: uploaded.url,
          thumbUrl: uploaded.thumbUrl,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          width: uploaded.width ?? null,
          height: uploaded.height ?? null,
          originalName: uploaded.originalName ?? null,
        },
      ]);

      for (const g of visibleGroups) {
        if (g.type === "IMAGE_UPLOAD") clearFieldError(g.code);
      }
      setUploadError(null);
      reconnectRealtimeSocket();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not upload reference image.";
      setPendingUploads((prev) =>
        prev.map((item) =>
          item.localId === localId ? { ...item, status: "error", error: message } : item,
        ),
      );
      setUploadError(message);
      notifyError(message);
    }
  }

  async function handleFilesSelected(files: FileList | null, cap: number) {
    if (!files || files.length === 0) return;
    setUploadError(null);

    const remaining = Math.max(0, cap - (images.length + activeUploadingCount));
    if (remaining <= 0) {
      const msg = `Maximum ${cap} reference images allowed.`;
      setUploadError(msg);
      notifyError(msg);
      return;
    }

    const queue = Array.from(files).slice(0, remaining);
    const items: PendingCustomizationUpload[] = queue.map((file, idx) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      return {
        localId: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl,
        progress: 5,
        status: "uploading",
      };
    });

    setPendingUploads((prev) => [...prev, ...items]);

    for (const item of items) {
      await uploadSingleFile(item.localId, item.file);
    }
  }

  function handleRetryPending(item: PendingCustomizationUpload) {
    setUploadError(null);
    setPendingUploads((prev) =>
      prev.map((p) =>
        p.localId === item.localId
          ? { ...p, status: "uploading", progress: 10, error: undefined }
          : p,
      ),
    );
    void uploadSingleFile(item.localId, item.file);
  }

  function handleDismissPending(localId: string) {
    setPendingUploads((prev) => {
      const found = prev.find((p) => p.localId === localId);
      if (found) {
        previewUrlsRef.current.delete(found.previewUrl);
        URL.revokeObjectURL(found.previewUrl);
      }
      return prev.filter((p) => p.localId !== localId);
    });
  }

  function handleRemoveImage(storageKey: string) {
    setImages((prev) => prev.filter((img) => img.storageKey !== storageKey));
  }

  async function handleSendOtp() {
    const cleanEmail = customerEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setFieldErrors((prev) => ({
        ...prev,
        customerEmail: "Enter a valid email address first.",
      }));
      return;
    }
    setSendingOtp(true);
    const res = await sendGuestCustomizationOtpAction({ email: cleanEmail });
    setSendingOtp(false);
    if (!res.ok) {
      notifyError(res.error.message);
      return;
    }
    setOtpSentTo(res.data.maskedEmail);
    notifySuccess(`Verification code sent to ${res.data.maskedEmail}.`);
  }

  async function handleVerifyOtp() {
    const cleanEmail = customerEmail.trim().toLowerCase();
    if (!/^\d{6}$/.test(otpCode.trim())) {
      notifyError("Enter the 6-digit verification code sent to your email.");
      return;
    }
    setVerifyingOtp(true);
    const res = await verifyGuestCustomizationOtpAction({
      email: cleanEmail,
      code: otpCode.trim(),
    });
    setVerifyingOtp(false);
    if (!res.ok) {
      notifyError(res.error.message);
      return;
    }
    setOtpVerifiedEmail(cleanEmail);
    reconnectRealtimeSocket();
    notifySuccess("Email verified. You can now submit your bespoke request.");
  }

  function validateClientSide(): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const group of visibleGroups) {
      const inp = inputs[group.code];
      if (group.type === "SELECT" || group.type === "SWATCH") {
        if (group.required && !inp?.value?.trim()) {
          errs[group.code] = `${group.label} is required.`;
        }
      } else if (group.type === "MULTI_SELECT") {
        const len = inp?.values?.length ?? 0;
        if (group.required && len === 0) {
          errs[group.code] = `Select at least one option for ${group.label}.`;
        } else if (group.minValue && len > 0 && len < Number(group.minValue)) {
          errs[group.code] = `Select at least ${group.minValue} options.`;
        } else if (group.maxValue && len > Number(group.maxValue)) {
          errs[group.code] = `Select at most ${group.maxValue} options.`;
        }
      } else if (group.type === "NUMBER_RANGE") {
        const raw = inp?.numberValue ?? inp?.value ?? "";
        const str = String(raw).trim();
        if (group.required && !str) {
          errs[group.code] = `${group.label} is required.`;
        } else if (str) {
          const n = Number(str);
          if (!Number.isFinite(n)) {
            errs[group.code] = `${group.label} must be a valid number.`;
          } else if (group.minValue !== null && n < Number(group.minValue)) {
            errs[group.code] = `Minimum ${group.minValue}${group.unit ? ` ${group.unit}` : ""}.`;
          } else if (group.maxValue !== null && n > Number(group.maxValue)) {
            errs[group.code] = `Maximum ${group.maxValue}${group.unit ? ` ${group.unit}` : ""}.`;
          }
        }
      } else if (group.type === "TEXT" || group.type === "TEXTAREA") {
        const txt = (inp?.textValue ?? inp?.value ?? "").trim();
        if (group.required && !txt) {
          errs[group.code] = `${group.label} is required.`;
        }
      } else if (group.type === "IMAGE_UPLOAD") {
        if (group.required && images.length === 0) {
          errs[group.code] = `Please attach at least one reference image for ${group.label}.`;
        }
      }
    }

    if (mode === "create") {
      if (customerName.trim().length < 2) {
        errs.customerName = "Full name is required.";
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) {
        errs.customerEmail = "Valid email address is required.";
      }
      if (contactUiChoice === "PHONE" && customerPhone.trim().length < 6) {
        errs.customerPhone = "Please enter your phone number for phone contact.";
      }
    } else if (contactUiChoice === "PHONE" && customerPhone.trim().length < 6) {
      errs.customerPhone = "Please enter your phone number for phone contact.";
    }

    return errs;
  }

  async function submitCustomization() {
    if (submitting) return;
    if (activeUploadingCount > 0) {
      notifyError("Please wait for reference images to finish uploading.");
      return;
    }

    setSubmitError(null);
    const errs = validateClientSide();
    const errKeys = Object.keys(errs);
    if (errKeys.length > 0) {
      setFieldErrors(errs);
      notifyError("Please review the highlighted customization fields.");
      const firstKey = errKeys[0]!;
      jumpToField(firstKey);
      return;
    }

    const sanitizedSelections: Record<string, SubmittedGroupInput> = {};
    for (const group of visibleGroups) {
      if (group.type === "IMAGE_UPLOAD") {
        sanitizedSelections[group.code] = { imageCount: images.length };
      } else if (inputs[group.code]) {
        sanitizedSelections[group.code] = inputs[group.code]!;
      }
    }

    const apiContactPreference: "EMAIL" | "PHONE" = contactUiChoice === "PHONE" ? "PHONE" : "EMAIL";

    setSubmitting(true);
    if (mode === "edit" && initialRequest) {
      const res = await editCustomizationRequestAction({
        requestId: initialRequest.id,
        selections: sanitizedSelections,
        uploadedImages: images.map((img) => ({
          storageKey: img.storageKey,
          thumbKey: img.thumbKey,
          mimeType: img.mimeType,
          sizeBytes: img.sizeBytes,
          width: img.width,
          height: img.height,
          originalName: img.originalName,
        })),
        customerPhone: customerPhone.trim() || null,
        contactPreference: apiContactPreference,
        preferredTimeline: preferredTimeline.trim() || null,
        preferredDate: preferredDate.trim() || null,
        customerNote: customerNote.trim() || null,
      });
      setSubmitting(false);
      if (!res.ok) {
        setSubmitError(res.error.message);
        notifyError(res.error.message);
        return;
      }
      unsavedGuard.markClean();
      notifySuccess("Customization request updated.");
      onSuccess?.(res.data);
      return;
    }

    const res = await createCustomizationRequestAction({
      productId: schema.productId,
      variantId: schema.defaultVariantId,
      selections: sanitizedSelections,
      uploadedImages: images.map((img) => ({
        storageKey: img.storageKey,
        thumbKey: img.thumbKey,
        mimeType: img.mimeType,
        sizeBytes: img.sizeBytes,
        width: img.width,
        height: img.height,
        originalName: img.originalName,
      })),
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim() || null,
      contactPreference: apiContactPreference,
      preferredTimeline: preferredTimeline.trim() || null,
      preferredDate: preferredDate.trim() || null,
      customerNote: customerNote.trim() || null,
      guestVerificationCode:
        !signedInUser && /^\d{6}$/.test(otpCode.trim()) ? otpCode.trim() : null,
    });
    setSubmitting(false);

    if (!res.ok) {
      setSubmitError(res.error.message);
      notifyError(res.error.message);
      return;
    }

    unsavedGuard.markClean();
    reconnectRealtimeSocket();
    notifySuccess(`Bespoke request ${res.data.requestNumber} submitted.`);
    setSubmittedDetail(res.data);
    onSuccess?.(res.data);
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitCustomization();
  }

  function handleCancelAction() {
    if (variant === "drawer") {
      onCancel?.();
      return;
    }
    if (onCancel) {
      unsavedGuard.confirmLeave(onCancel);
      return;
    }
    unsavedGuard.confirmLeave(() => {
      router.push(`/products/${schema.productSlug}`);
    });
  }

  const errorEntries = React.useMemo(() => {
    const labelByKey = new Map<string, string>(visibleGroups.map((g) => [g.code, g.label]));
    labelByKey.set("customerName", "Full name");
    labelByKey.set("customerEmail", "Email address");
    labelByKey.set("customerPhone", "Phone number");
    return Object.entries(fieldErrors).map(([key, msg]) => ({
      key,
      label: labelByKey.get(key) ?? key,
      message: msg,
    }));
  }, [fieldErrors, visibleGroups]);

  const showTopErrorSummary = errorEntries.length > 2 || Boolean(submitError);

  const errorBanner = showTopErrorSummary ? (
    <div
      ref={errorSummaryRef}
      role="alert"
      data-testid="customization-error-summary"
      className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-sm text-destructive"
    >
      {submitError ? (
        <p className="flex items-start gap-2 font-medium">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{submitError}</span>
        </p>
      ) : null}

      {errorEntries.length > 2 ? (
        <div className={cn(submitError && "mt-2.5 border-t border-destructive/20 pt-2.5")}>
          <p className="font-medium">Please review {errorEntries.length} required fields:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs">
            {errorEntries.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => jumpToField(item.key)}
                  className="text-left underline underline-offset-4 hover:opacity-80"
                >
                  {item.label}: {item.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  ) : null;

  if (submittedDetail && mode === "create") {
    if (variant === "drawer") {
      return (
        <div className="flex h-full min-h-0 flex-col">
          {!hideHeader ? (
            <CustomizeHeader
              variant="drawer"
              productName={schema.productName}
              productImageUrl={schema.productImageUrl}
              basePriceBase={schema.productBasePriceBase}
              showHelper={false}
              onClose={onCancel}
            />
          ) : null}
          <div className="safe-area-pb flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <CustomizeSuccessState
              detail={submittedDetail}
              productSlug={schema.productSlug}
              signedInUser={signedInUser}
              variant="drawer"
              onDone={onCancel}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="py-4 sm:py-8">
        <CustomizeSuccessState
          detail={submittedDetail}
          productSlug={schema.productSlug}
          signedInUser={signedInUser}
          variant="page"
        />
      </div>
    );
  }

  const optionsContent = (
    <div className="space-y-6 sm:space-y-7">
      {visibleGroups.map((group) => (
        <OptionGroup
          key={group.id}
          group={group}
          input={inputs[group.code]}
          error={fieldErrors[group.code]}
          baseUid={baseUid}
          variant={variant}
          onChange={(next) => updateGroupInput(group.code, next)}
          images={images}
          pendingUploads={pendingUploads}
          uploadError={uploadError}
          uploadInputRef={uploadInputRef}
          onFilesSelected={(files, maxCap) => void handleFilesSelected(files, maxCap)}
          onRemoveImage={handleRemoveImage}
          onDismissPending={handleDismissPending}
          onRetryPending={handleRetryPending}
          onOpenLightbox={(idx) => setLightboxIndex(idx)}
        />
      ))}
    </div>
  );

  const detailsContent = (
    <CustomizeDetailsStep
      baseUid={baseUid}
      mode={mode}
      variant={variant}
      signedInUser={signedInUser}
      customerName={customerName}
      customerEmail={customerEmail}
      customerPhone={customerPhone}
      contactUiChoice={contactUiChoice}
      preferredTimeline={preferredTimeline}
      preferredDate={preferredDate}
      customerNote={customerNote}
      otpSentTo={otpSentTo}
      otpCode={otpCode}
      otpVerifiedEmail={otpVerifiedEmail}
      sendingOtp={sendingOtp}
      verifyingOtp={verifyingOtp}
      fieldErrors={fieldErrors}
      onCustomerNameChange={(val) => {
        setUserEditedIdentity(true);
        setCustomerName(val);
        clearFieldError("customerName");
      }}
      onCustomerEmailChange={(val) => {
        setUserEditedIdentity(true);
        setCustomerEmail(val);
        clearFieldError("customerEmail");
      }}
      onCustomerPhoneChange={(val) => {
        setCustomerPhone(val);
        clearFieldError("customerPhone");
      }}
      onContactUiChoiceChange={(choice) => {
        setContactUiChoice(choice);
        clearFieldError("customerPhone");
      }}
      onPreferredTimelineChange={setPreferredTimeline}
      onPreferredDateChange={setPreferredDate}
      onCustomerNoteChange={setCustomerNote}
      onOtpCodeChange={setOtpCode}
      onSendOtp={() => void handleSendOtp()}
      onVerifyOtp={() => void handleVerifyOtp()}
    />
  );

  const summaryContent = (
    <SummaryPanel
      visibleGroups={visibleGroups}
      inputs={inputs}
      imageCount={images.length}
      estimatedMinBase={indicative.minBase}
      mode={mode}
      variant={variant}
      submitting={submitting}
      showContactSummary
      customerName={customerName}
      customerEmail={customerEmail}
      customerPhone={customerPhone}
      contactUiChoice={contactUiChoice}
      onEditGroup={(groupCode) => jumpToField(groupCode)}
      onEditDetails={() => handleStepSelect(2)}
      onSubmitClick={() => void submitCustomization()}
      onCancel={handleCancelAction}
    />
  );

  if (variant === "drawer") {
    return (
      <>
        <form
          ref={formRef}
          onSubmit={handleFormSubmit}
          noValidate
          className="flex h-full min-h-0 flex-col"
        >
          {!hideHeader ? (
            <CustomizeHeader
              variant="drawer"
              productName={schema.productName}
              productImageUrl={schema.productImageUrl}
              basePriceBase={schema.productBasePriceBase}
              mode={mode}
              requestNumber={initialRequest?.requestNumber}
              showHelper={step === 1}
              onOpenFullPage={onOpenFullPage}
              onClose={onCancel}
            />
          ) : null}

          <CustomizeProgress variant="drawer" step={step} onSelectStep={handleStepSelect} />

          <div
            ref={drawerScrollRef}
            className="drawer-scroll min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-6 sm:py-7"
          >
            {errorBanner}
            <div className={step === 1 ? "block" : "hidden"}>
              <p className="mb-5 hidden text-[13px] leading-relaxed text-muted-foreground sm:block [@media(max-height:500px)]:hidden">
                Choose your options and we&apos;ll send a quote within 24 hours.
              </p>
              {optionsContent}
            </div>
            <div className={step === 2 ? "block" : "hidden"}>{detailsContent}</div>
            {step === 3 ? <div>{summaryContent}</div> : null}
          </div>

          <StickyActionBar
            variant="drawer"
            step={step}
            mode={mode}
            estimatedMinBase={indicative.minBase}
            submitting={submitting}
            onBack={() => handleStepSelect((step > 1 ? step - 1 : 1) as CustomizeStep)}
            onNext={() => handleStepSelect((step < 3 ? step + 1 : 3) as CustomizeStep)}
            onSubmitClick={() => void submitCustomization()}
          />
        </form>

        <PrivateImageLightbox
          images={lightboxImages}
          activeIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      </>
    );
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleFormSubmit} noValidate className="w-full">
        {!hideHeader ? (
          <CustomizeHeader
            variant="page"
            productName={schema.productName}
            productImageUrl={schema.productImageUrl}
            basePriceBase={schema.productBasePriceBase}
            mode={mode}
            requestNumber={initialRequest?.requestNumber}
            showHelper
          />
        ) : null}

        <CustomizeProgress variant="page" step={step} onSelectStep={handleStepSelect} />

        <div className="mx-auto w-full max-w-[720px] pt-6 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-8">
          <div className="min-w-0">
            {errorBanner}

            <div className={cn(step === 1 ? "block" : "hidden lg:block")}>{optionsContent}</div>

            <div className={cn(step === 2 ? "block" : "hidden lg:mt-6 lg:block")}>
              {detailsContent}
            </div>
          </div>

          <div className={cn("min-w-0", step === 3 ? "block" : "hidden lg:block")}>
            {summaryContent}
          </div>
        </div>

        <StickyActionBar
          variant="page"
          step={step}
          mode={mode}
          estimatedMinBase={indicative.minBase}
          submitting={submitting}
          onBack={() => handleStepSelect((step > 1 ? step - 1 : 1) as CustomizeStep)}
          onNext={() => handleStepSelect((step < 3 ? step + 1 : 3) as CustomizeStep)}
          onSubmitClick={() => void submitCustomization()}
        />
      </form>

      <PrivateImageLightbox
        images={lightboxImages}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />

      {unsavedGuard.dialog}
    </>
  );
}
