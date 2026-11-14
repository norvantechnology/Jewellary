"use client";

import * as React from "react";

/**
 * Makes the phone/browser Back button behave like a native app for every modal, sheet and drawer:
 *
 * - Opening a modal adds one history entry, so Back closes the top-most modal instead of
 *   leaving the page.
 * - If Back fires while the on-screen keyboard is up (a text field inside the modal has focus
 *   on a touch device), the first Back only hides the keyboard and the modal stays open.
 * - Closing the modal with its X/overlay removes that history entry again.
 * - Following a link from inside a modal leaves a stale entry behind; it is skipped automatically
 *   when the user later presses Back, so Back never appears to "do nothing".
 */

type HistoryState = Record<string, unknown> & { __modal?: string };

const openStack: string[] = [];
const pendingBack = new Map<string, number>();
let navigatingAwayUntil = 0;
let globalListenersInstalled = false;

function currentState(): HistoryState {
  return (window.history.state ?? {}) as HistoryState;
}

/** Call right before a programmatic router.push() from inside an open modal. */
export function markModalNavigation() {
  navigatingAwayUntil = Date.now() + 2000;
}

export function isTouchTextInputFocused(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia("(pointer: coarse)").matches) return false;
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement || el.isContentEditable) return true;
  return (
    el instanceof HTMLInputElement &&
    !["checkbox", "radio", "button", "submit", "range", "color", "file"].includes(el.type)
  );
}

function installGlobalListeners() {
  if (globalListenersInstalled) return;
  globalListenersInstalled = true;

  // An internal link clicked inside a modal starts a navigation: don't pop history on close.
  document.addEventListener(
    "click",
    (event) => {
      if (openStack.length === 0 || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank") return;
      if (anchor.origin !== window.location.origin) return;
      if (anchor.pathname + anchor.search === window.location.pathname + window.location.search) {
        return;
      }
      markModalNavigation();
    },
    true,
  );

  // Landing on a stale modal entry (its modal is already gone): step over it.
  window.addEventListener("popstate", () => {
    const id = currentState().__modal;
    if (id && !openStack.includes(id)) window.history.back();
  });
}

export function useModalHistory(open: boolean, requestClose: () => void) {
  const id = React.useId();
  const closeRef = React.useRef(requestClose);
  React.useEffect(() => {
    closeRef.current = requestClose;
  });

  React.useEffect(() => {
    if (!open) return;
    installGlobalListeners();

    const pending = pendingBack.get(id);
    if (pending !== undefined) {
      // Re-mounted straight after a cleanup (React Strict Mode / fast refresh): keep the entry.
      window.clearTimeout(pending);
      pendingBack.delete(id);
    }
    if (currentState().__modal !== id) {
      window.history.pushState({ ...currentState(), __modal: id }, "");
    }
    openStack.push(id);

    let closedByBack = false;
    const onPopState = () => {
      if (openStack[openStack.length - 1] !== id || currentState().__modal === id) return;
      if (isTouchTextInputFocused()) {
        // First Back = hide the keyboard only. Re-add our entry and keep the modal open.
        (document.activeElement as HTMLElement).blur();
        window.history.pushState({ ...currentState(), __modal: id }, "");
        return;
      }
      closedByBack = true;
      closeRef.current();
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
      const idx = openStack.lastIndexOf(id);
      if (idx !== -1) openStack.splice(idx, 1);
      if (closedByBack || Date.now() < navigatingAwayUntil) return;
      // Closed with X / overlay / Escape: remove our history entry (deferred so a quick
      // re-mount can cancel it).
      pendingBack.set(
        id,
        window.setTimeout(() => {
          pendingBack.delete(id);
          if (currentState().__modal === id && Date.now() >= navigatingAwayUntil) {
            window.history.back();
          }
        }, 0),
      );
    };
  }, [open, id]);
}

/**
 * Radix closes dialogs on Escape. Some Android keyboards send Escape when the keyboard is
 * dismissed, so on touch devices with a focused text field Escape only hides the keyboard.
 */
export function keepOpenOnKeyboardEscape(event: KeyboardEvent) {
  if (isTouchTextInputFocused()) {
    event.preventDefault();
    (document.activeElement as HTMLElement).blur();
  }
}

/**
 * Touch screens: don't auto-focus a text field when a dialog/sheet opens (the keyboard would
 * cover the content). Focus the panel itself instead, so screen readers still land inside it.
 */
export function focusPanelOnTouch(event: Event) {
  if (typeof window === "undefined" || !window.matchMedia("(pointer: coarse)").matches) return;
  event.preventDefault();
  const panel = event.currentTarget as HTMLElement | null;
  panel?.focus({ preventScroll: true });
}
