"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { archiveProductAction, deleteProductAction } from "@/modules/catalog/catalog.actions";

interface ProductDeleteDialogProps {
  target: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  onArchived: () => void;
}

/**
 * Shared ADMIN-only permanent product deletion dialog implementing AD-23:
 * blocks permanent deletion if historical orders exist and offers one-click archival instead.
 */
export function ProductDeleteDialog({
  target,
  onOpenChange,
  onDeleted,
  onArchived,
}: ProductDeleteDialogProps) {
  const [busy, setBusy] = React.useState(false);
  const [blockedState, setBlockedState] = React.useState<{
    productId: string;
    reason: string;
  } | null>(null);

  const blockedReason =
    target && blockedState?.productId === target.id ? blockedState.reason : null;

  async function handlePermanentDelete() {
    if (!target) return;
    setBusy(true);
    setBlockedState(null);
    const res = await deleteProductAction({ id: target.id });
    setBusy(false);

    if (!res.ok) {
      if (res.error.code === "CONFLICT") {
        setBlockedState({ productId: target.id, reason: res.error.message });
        return;
      }
      toast.error(res.error.message);
      return;
    }

    toast.success(`Permanently deleted "${target.name}" and cleaned storage media.`);
    onOpenChange(false);
    onDeleted();
  }

  async function handleArchiveFallback() {
    if (!target) return;
    setBusy(true);
    const res = await archiveProductAction({ id: target.id });
    setBusy(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    toast.success(`Archived "${target.name}". Historical order snapshots remain intact.`);
    onOpenChange(false);
    onArchived();
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Product Permanently</DialogTitle>
          <DialogDescription>
            {target
              ? `Permanently delete "${target.name}" and remove its uploaded images from storage? Only products that have never been ordered can be deleted permanently.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {blockedReason && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-sm border border-border bg-surface p-3 text-sm text-foreground"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-text" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">Permanent deletion blocked</p>
              <p className="text-xs text-muted-foreground">{blockedReason}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          {blockedReason ? (
            <Button type="button" loading={busy} onClick={() => void handleArchiveFallback()}>
              Archive Instead
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              loading={busy}
              onClick={() => void handlePermanentDelete()}
            >
              Delete Permanently
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
