"use client";

export const TOAST_ACTIVATE_EVENT = "ma:toast-activate";

function activateToaster(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(TOAST_ACTIVATE_EVENT));
  }
}

export async function notifySuccess(message: string): Promise<void> {
  activateToaster();
  const { toast } = await import("sonner");
  toast.success(message);
}

export async function notifyError(message: string): Promise<void> {
  activateToaster();
  const { toast } = await import("sonner");
  toast.error(message);
}

export async function notifyInfo(message: string): Promise<void> {
  activateToaster();
  const { toast } = await import("sonner");
  toast.info(message);
}
