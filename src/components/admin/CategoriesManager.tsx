"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Edit2, FolderTree, Plus, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { NativeSelect } from "@/components/ui/native-select";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteCategoryAction, upsertCategoryAction } from "@/modules/catalog/catalog.actions";
import type { AdminCategoryDTO, AdminFacetDTO } from "@/modules/catalog/catalog.service";

interface CategoryFormState {
  id?: string;
  name: string;
  slug: string;
  parentId: string;
  description: string;
  imageUrl: string;
  ogImageUrl: string;
  ogTitle: string;
  ogDescription: string;
  seoFaqs: AdminCategoryDTO["seoFaqs"];
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  seoIntroCopy: string;
  seoIntroPosition: "top" | "bottom";
  canonicalOverride: string;
  noindex: boolean;
  sortOrder: string;
  isActive: boolean;
  facetIds: string[];
}

const emptyForm = (): CategoryFormState => ({
  name: "",
  slug: "",
  parentId: "__none__",
  description: "",
  imageUrl: "",
  ogImageUrl: "",
  ogTitle: "",
  ogDescription: "",
  seoFaqs: [],
  seoTitle: "",
  seoDescription: "",
  seoKeywords: "",
  seoIntroCopy: "",
  seoIntroPosition: "top",
  canonicalOverride: "",
  noindex: false,
  sortOrder: "0",
  isActive: true,
  facetIds: [],
});

export function CategoriesManager({
  categories,
  facets,
  canDelete,
}: {
  categories: AdminCategoryDTO[];
  facets: AdminFacetDTO[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<CategoryFormState>(emptyForm);
  const [savedSnapshot, setSavedSnapshot] = React.useState(() => JSON.stringify(emptyForm()));
  const currentSnapshot = React.useMemo(() => JSON.stringify(form), [form]);
  const unsavedGuard = useUnsavedChangesGuard({
    isDirty: dialogOpen && currentSnapshot !== savedSnapshot,
  });
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<AdminCategoryDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  function openNew() {
    const initial = emptyForm();
    setForm(initial);
    setSavedSnapshot(JSON.stringify(initial));
    setFieldErrors({});
    setDialogOpen(true);
  }

  function openEdit(cat: AdminCategoryDTO) {
    const initial: CategoryFormState = {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId ?? "__none__",
      description: cat.description ?? "",
      imageUrl: cat.imageUrl ?? "",
      ogImageUrl: cat.ogImageUrl ?? "",
      ogTitle: cat.ogTitle ?? "",
      ogDescription: cat.ogDescription ?? "",
      seoFaqs: cat.seoFaqs ?? [],
      seoTitle: cat.seoTitle ?? "",
      seoDescription: cat.seoDescription ?? "",
      seoKeywords: cat.seoKeywords ?? "",
      seoIntroCopy: cat.seoIntroCopy ?? "",
      seoIntroPosition: cat.seoIntroPosition ?? "top",
      canonicalOverride: cat.canonicalOverride ?? "",
      noindex: Boolean(cat.noindex),
      sortOrder: String(cat.sortOrder),
      isActive: cat.isActive,
      facetIds: cat.facetIds,
    };
    setForm(initial);
    setSavedSnapshot(JSON.stringify(initial));
    setFieldErrors({});
    setDialogOpen(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const res = await upsertCategoryAction({
      id: form.id,
      name: form.name,
      slug: form.slug || null,
      parentId: form.parentId === "__none__" ? null : form.parentId,
      description: form.description || null,
      imageUrl: form.imageUrl || null,
      // Sent back unchanged when not edited, so saving never wipes share settings or FAQs.
      ogImageUrl: form.ogImageUrl || null,
      ogTitle: form.ogTitle || null,
      ogDescription: form.ogDescription || null,
      seoFaqs: form.seoFaqs,
      seoTitle: form.seoTitle || null,
      seoDescription: form.seoDescription || null,
      seoKeywords: form.seoKeywords || null,
      seoIntroCopy: form.seoIntroCopy || null,
      seoIntroPosition: form.seoIntroPosition,
      canonicalOverride: form.canonicalOverride || null,
      noindex: form.noindex,
      sortOrder: Number(form.sortOrder || "0"),
      isActive: form.isActive,
      facetIds: form.facetIds,
    });

    setSaving(false);

    if (!res.ok) {
      if (res.error.fieldErrors) setFieldErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      return;
    }

    unsavedGuard.markClean();
    setSavedSnapshot(currentSnapshot);
    toast.success(form.id ? "Category updated." : "Category created.");
    setDialogOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteCategoryAction({ id: deleteTarget.id });
    setDeleting(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    toast.success(`Deleted category "${deleteTarget.name}".`);
    setDeleteTarget(null);
    router.refresh();
  }

  function toggleFacet(facetId: string) {
    setForm((prev) => ({
      ...prev,
      facetIds: prev.facetIds.includes(facetId)
        ? prev.facetIds.filter((id) => id !== facetId)
        : [...prev.facetIds, facetId],
    }));
  }

  const columns: ResponsiveColumn<AdminCategoryDTO>[] = [
    {
      key: "name",
      hideOnMobileCard: true,
      header: "Category",
      cell: (c) => (
        <div>
          <p className="font-medium text-foreground">{c.name}</p>
          <p className="font-mono text-xs text-muted-foreground">/collections/{c.path}</p>
        </div>
      ),
    },
    {
      key: "parent",
      header: "Parent",
      cell: (c) => c.parentName ?? <span className="text-muted-foreground">Top-level</span>,
    },
    {
      key: "products",
      header: "Pieces",
      cell: (c) => <span className="tabular-nums-price">{c.productCount}</span>,
    },
    {
      key: "facets",
      header: "Filter Facets",
      cell: (c) => <span className="tabular-nums-price">{c.facetIds.length}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => (
        <Badge variant={c.isActive ? "success" : "default"}>
          {c.isActive ? "Active" : "Hidden"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (c) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openEdit(c)}
            aria-label={`Edit category ${c.name}`}
          >
            <Edit2 className="size-3.5" aria-hidden="true" />
            <span>Edit</span>
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setDeleteTarget(c)}
              aria-label={`Delete category ${c.name}`}
              disabled={c.productCount > 0 || c.childCount > 0}
            >
              <Trash2 className="size-4 text-destructive" aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const eligibleParents = categories.filter((c) => c.id !== form.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-editorial-label text-accent-text">Collections Architecture</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground">Categories</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage hierarchical collection paths, facet bindings, and automatic 301 slug redirects.
          </p>
        </div>

        <Button type="button" onClick={openNew} className="gap-1.5">
          <Plus className="size-4" aria-hidden="true" />
          <span>New Category</span>
        </Button>
      </div>

      <ResponsiveDataTable
        data={categories}
        columns={columns}
        keyExtractor={(c) => c.id}
        mobileTitle={(c) => c.name}
        emptyState={
          <EmptyState
            icon={FolderTree}
            title="No Categories Created"
            description="Organize your jewelry into categories and subcategories."
            actionLabel="Create Category"
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
            <DialogTitle>{form.id ? "Edit Category" : "Create Category"}</DialogTitle>
            <DialogDescription>
              Updating a slug or parent automatically records 301 redirects for previous URLs.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="cat-name" label="Category Name" required error={fieldErrors.name?.[0]}>
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Solitaire Rings"
                    required
                  />
                )}
              </FormField>

              <FormField
                id="cat-slug"
                label="URL Slug"
                hint="Leave blank to derive from name"
                error={fieldErrors.slug?.[0]}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    placeholder="solitaire-rings"
                  />
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cat-parent">Parent Category</Label>
                <Select
                  value={form.parentId}
                  onValueChange={(value) => setForm((f) => ({ ...f, parentId: value }))}
                >
                  <SelectTrigger id="cat-parent">
                    <SelectValue placeholder="Top-level category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Top-level category</SelectItem>
                    {eligibleParents.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} (/collections/{p.path})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.parentId?.[0] && (
                  <p className="text-xs font-medium text-destructive">{fieldErrors.parentId[0]}</p>
                )}
              </div>

              <FormField id="cat-sort" label="Sort Order" error={fieldErrors.sortOrder?.[0]}>
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

            <FormField
              id="cat-description"
              label="Collection Intro"
              error={fieldErrors.description?.[0]}
            >
              {(aria) => (
                <Textarea
                  {...aria}
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Handcrafted solitaire designs with GIA-certified center stones."
                />
              )}
            </FormField>

            <ImageUploadField
              id="cat-image"
              folder="categories"
              label="Banner image"
              currentUrl={form.imageUrl}
              onUrlChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              onUploaded={(asset) => setForm((f) => ({ ...f, imageUrl: asset.url }))}
            />
            <p className="-mt-2 text-xs text-muted-foreground">
              Shown at the top of this category page. Also used for Google and link previews unless
              a share image is set below. Wide images work best (about 1600 × 500 px).
            </p>

            <ImageUploadField
              id="cat-og-image"
              folder="categories"
              label="Share image (optional)"
              currentUrl={form.ogImageUrl}
              onUrlChange={(url) => setForm((f) => ({ ...f, ogImageUrl: url }))}
              onUploaded={(asset) => setForm((f) => ({ ...f, ogImageUrl: asset.url }))}
            />
            <p className="-mt-2 text-xs text-muted-foreground">
              Picture shown when the page is shared on WhatsApp, Facebook or X. Best size 1200 × 630
              px. Leave empty to use the banner image.
            </p>

            <div className="space-y-2 rounded-sm border border-border bg-muted/30 p-3.5">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Bound Collection Filter Facets
              </p>
              {facets.length === 0 ? (
                <p className="text-xs text-muted-foreground">No facets defined yet.</p>
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {facets.map((facet) => {
                    const checked = form.facetIds.includes(facet.id);
                    const checkId = `cat-facet-${facet.id}`;
                    return (
                      <div key={facet.id} className="flex items-center gap-2.5">
                        <Checkbox
                          id={checkId}
                          checked={checked}
                          onCheckedChange={() => toggleFacet(facet.id)}
                        />
                        <Label htmlFor={checkId} className="cursor-pointer font-normal">
                          {facet.name}{" "}
                          <span className="font-mono text-xs text-muted-foreground">
                            ({facet.code})
                          </span>
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="cat-seo-title"
                label={`SEO Title (${form.seoTitle.length}/60)`}
                error={fieldErrors.seoTitle?.[0]}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.seoTitle}
                    onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                  />
                )}
              </FormField>

              <FormField
                id="cat-seo-desc"
                label={`SEO Description (${form.seoDescription.length}/158)`}
                error={fieldErrors.seoDescription?.[0]}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.seoDescription}
                    onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
                  />
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="cat-seo-keywords" label="SEO Keywords">
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.seoKeywords}
                    onChange={(e) => setForm((f) => ({ ...f, seoKeywords: e.target.value }))}
                    placeholder="diamond engagement rings, platinum solitaire"
                  />
                )}
              </FormField>
              <FormField id="cat-intro-pos" label="Collection Intro Copy Placement">
                {(aria) => (
                  <NativeSelect
                    {...aria}
                    value={form.seoIntroPosition}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        seoIntroPosition: e.target.value === "bottom" ? "bottom" : "top",
                      }))
                    }
                  >
                    <option value="top">Top (Above Product Grid)</option>
                    <option value="bottom">Bottom (Editorial Footer Copy)</option>
                  </NativeSelect>
                )}
              </FormField>
            </div>

            <FormField id="cat-intro-copy" label="Collection SEO Intro Copy">
              {(aria) => (
                <Textarea
                  {...aria}
                  rows={2}
                  value={form.seoIntroCopy}
                  onChange={(e) => setForm((f) => ({ ...f, seoIntroCopy: e.target.value }))}
                  placeholder="Optional editorial paragraph displayed on the collection page"
                />
              )}
            </FormField>

            <div className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5">
              <div>
                <Label htmlFor="cat-noindex">Exclude from Search Indexing (noindex)</Label>
                <p className="text-xs text-muted-foreground">
                  Suppress indexing &amp; omit from collection sitemaps.
                </p>
              </div>
              <Switch
                id="cat-noindex"
                checked={form.noindex}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, noindex: checked }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5">
              <div>
                <Label htmlFor="cat-active">Visible in Navigation &amp; Storefront</Label>
                <p className="text-xs text-muted-foreground">
                  Hidden categories do not appear in the mega menu.
                </p>
              </div>
              <Switch
                id="cat-active"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))}
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
                {form.id ? "Save Changes" : "Create Category"}
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
        title="Delete Category"
        description={
          deleteTarget ? `Permanently delete "${deleteTarget.name}"? This cannot be undone.` : ""
        }
        confirmLabel="Delete Category"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
