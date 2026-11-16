"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Edit2, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { ImageUploadField } from "@/components/shared/ImageUploadField";
import {
  ResponsiveDataTable,
  type ResponsiveColumn,
} from "@/components/shared/ResponsiveDataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { deleteBannerAction, upsertBannerAction } from "@/modules/banners/banner.actions";
import type { BannerDTO } from "@/modules/banners/banner.service";

interface BannerFormState {
  id?: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  mobileImageUrl: string;
  altText: string;
  position: "HERO" | "STRIP" | "EDITORIAL";
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  sortOrder: string;
}

const emptyBanner = (): BannerFormState => ({
  title: "",
  subtitle: "",
  ctaLabel: "Explore Collection",
  ctaHref: "/collections",
  imageUrl: "",
  mobileImageUrl: "",
  altText: "",
  position: "HERO",
  isActive: true,
  startsAt: "",
  endsAt: "",
  sortOrder: "0",
});

export function BannersManager({ banners }: { banners: BannerDTO[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<BannerFormState>(emptyBanner);
  const [savedSnapshot, setSavedSnapshot] = React.useState(() => JSON.stringify(emptyBanner()));
  const currentSnapshot = React.useMemo(() => JSON.stringify(form), [form]);
  const unsavedGuard = useUnsavedChangesGuard({
    isDirty: dialogOpen && currentSnapshot !== savedSnapshot,
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<BannerDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  function openNew() {
    const initial = emptyBanner();
    setForm(initial);
    setSavedSnapshot(JSON.stringify(initial));
    setFieldErrors({});
    setDialogOpen(true);
  }

  function openEdit(b: BannerDTO) {
    const initial: BannerFormState = {
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? "",
      ctaLabel: b.ctaLabel ?? "",
      ctaHref: b.ctaHref ?? "",
      imageUrl: b.imageUrl,
      mobileImageUrl: b.mobileImageUrl ?? "",
      altText: b.altText,
      position: b.position,
      isActive: b.isActive,
      startsAt: b.startsAt ? b.startsAt.slice(0, 16) : "",
      endsAt: b.endsAt ? b.endsAt.slice(0, 16) : "",
      sortOrder: String(b.sortOrder),
    };
    setForm(initial);
    setSavedSnapshot(JSON.stringify(initial));
    setFieldErrors({});
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const res = await upsertBannerAction({
      id: form.id,
      title: form.title,
      subtitle: form.subtitle || null,
      ctaLabel: form.ctaLabel || null,
      ctaHref: form.ctaHref || null,
      imageUrl: form.imageUrl,
      mobileImageUrl: form.mobileImageUrl || null,
      altText: form.altText,
      position: form.position,
      isActive: form.isActive,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      sortOrder: Number(form.sortOrder || "0"),
    });

    setSaving(false);

    if (!res.ok) {
      if (res.error.fieldErrors) setFieldErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      return;
    }

    unsavedGuard.markClean();
    setSavedSnapshot(currentSnapshot);
    toast.success(form.id ? "Banner updated." : "Banner created.");
    setDialogOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteBannerAction({ id: deleteTarget.id });
    setDeleting(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    toast.success(`Deleted banner "${deleteTarget.title}".`);
    setDeleteTarget(null);
    router.refresh();
  }

  const columns: ResponsiveColumn<BannerDTO>[] = [
    {
      key: "title",
      hideOnMobileCard: true,
      header: "Banner",
      cell: (b) => (
        <div className="flex min-w-0 items-center justify-end gap-3 md:justify-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={b.imageUrl}
            alt={b.altText}
            className="h-12 w-20 shrink-0 rounded-sm border border-border object-cover"
          />
          <div className="min-w-0">
            <p className="font-medium text-foreground">{b.title}</p>
            {b.subtitle && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{b.subtitle}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "position",
      header: "Placement",
      cell: (b) => <Badge variant="outline">{b.position}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      cell: (b) => (
        <Badge variant={b.isActive ? "success" : "default"}>
          {b.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "sort",
      header: "Order",
      cell: (b) => <span className="tabular-nums-price">{b.sortOrder}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (b) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(b)}>
            <Edit2 className="size-3.5" aria-hidden="true" />
            <span>Edit</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(b)}
            aria-label={`Delete banner ${b.title}`}
          >
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-editorial-label text-accent-text">Storefront Campaigns</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground">Banners</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage homepage hero frames, editorial strips, and seasonal campaign schedules.
          </p>
        </div>

        <Button type="button" onClick={openNew} className="gap-1.5">
          <Plus className="size-4" aria-hidden="true" />
          <span>New Banner</span>
        </Button>
      </div>

      <ResponsiveDataTable
        data={banners}
        columns={columns}
        keyExtractor={(b) => b.id}
        mobileTitle={(b) => b.title}
        emptyState={
          <EmptyState
            icon={ImageIcon}
            title="No Banners Configured"
            description="Create a hero or editorial campaign banner for the storefront."
            actionLabel="Create Banner"
            onAction={openNew}
          />
        }
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setDialogOpen(true);
            return;
          }
          unsavedGuard.confirmLeave(() => setDialogOpen(false));
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Banner" : "Create Banner"}</DialogTitle>
            <DialogDescription>
              Descriptive accessible alt text is required for every storefront banner image.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <FormField
              id="ban-title"
              label="Headline Title"
              required
              error={fieldErrors.title?.[0]}
            >
              {(aria) => (
                <Input
                  {...aria}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              )}
            </FormField>

            <FormField id="ban-sub" label="Subtitle" error={fieldErrors.subtitle?.[0]}>
              {(aria) => (
                <Input
                  {...aria}
                  value={form.subtitle}
                  onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="ban-cta" label="CTA Label">
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.ctaLabel}
                    onChange={(e) => setForm((f) => ({ ...f, ctaLabel: e.target.value }))}
                  />
                )}
              </FormField>
              <FormField id="ban-href" label="CTA Destination">
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.ctaHref}
                    onChange={(e) => setForm((f) => ({ ...f, ctaHref: e.target.value }))}
                  />
                )}
              </FormField>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ban-pos">Placement</Label>
                <Select
                  value={form.position}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, position: v as BannerFormState["position"] }))
                  }
                >
                  <SelectTrigger id="ban-pos">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HERO">Hero Carousel</SelectItem>
                    <SelectItem value="STRIP">Feature Strip</SelectItem>
                    <SelectItem value="EDITORIAL">Editorial Block</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ImageUploadField
              id="ban-desktop-img"
              folder="banners"
              label="Desktop Artwork *"
              currentUrl={form.imageUrl}
              onUrlChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              onUploaded={(asset) => setForm((f) => ({ ...f, imageUrl: asset.url }))}
            />
            <p className="-mt-2 text-xs text-muted-foreground">
              Shown on laptops and desktops in a 4:3 landscape frame. Best size: 1600 × 1200 px.
              Keep text and the jewelry near the centre; other shapes are filled from the centre.
            </p>
            {fieldErrors.imageUrl?.[0] && (
              <p className="text-xs font-medium text-destructive">{fieldErrors.imageUrl[0]}</p>
            )}

            <ImageUploadField
              id="ban-mobile-img"
              folder="banners"
              label="Mobile Artwork (Optional)"
              currentUrl={form.mobileImageUrl}
              onUrlChange={(url) => setForm((f) => ({ ...f, mobileImageUrl: url }))}
              onUploaded={(asset) => setForm((f) => ({ ...f, mobileImageUrl: asset.url }))}
            />
            <p className="-mt-2 text-xs text-muted-foreground">
              Shown on phones and tablets at its own shape (square or portrait works best, e.g. 1080
              × 1350 px). If empty, phones show the desktop artwork.
            </p>

            <FormField
              id="ban-alt"
              label="Accessible Image Alt Text"
              required
              error={fieldErrors.altText?.[0]}
            >
              {(aria) => (
                <Input
                  {...aria}
                  value={form.altText}
                  onChange={(e) => setForm((f) => ({ ...f, altText: e.target.value }))}
                  placeholder="18k gold bridal ring collection arranged on warm linen"
                  required
                />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="ban-start" label="Starts At (Optional)">
                {(aria) => (
                  <Input
                    {...aria}
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  />
                )}
              </FormField>
              <FormField id="ban-end" label="Ends At (Optional)">
                {(aria) => (
                  <Input
                    {...aria}
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                  />
                )}
              </FormField>
              <FormField id="ban-order" label="Sort Order">
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    min={0}
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                  />
                )}
              </FormField>
            </div>

            <div className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5">
              <Label htmlFor="ban-active" className="cursor-pointer">
                Banner Active
              </Label>
              <Switch
                id="ban-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => unsavedGuard.confirmLeave(() => setDialogOpen(false))}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {form.id ? "Save Banner" : "Create Banner"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {unsavedGuard.dialog}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Banner"
        description={deleteTarget ? `Delete banner "${deleteTarget.title}"?` : ""}
        confirmLabel="Delete Banner"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
