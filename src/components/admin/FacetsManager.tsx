"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Edit2, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { deleteFacetAction, upsertFacetAction } from "@/modules/catalog/catalog.actions";
import type { AdminFacetDTO } from "@/modules/catalog/catalog.service";

interface FacetOptionRow {
  id?: string;
  value: string;
  label: string;
  sortOrder: string;
  swatchHex: string;
}

interface FacetFormState {
  id?: string;
  code: string;
  name: string;
  valueType: "TEXT" | "NUMBER" | "BOOLEAN" | "RANGE";
  isFilterable: boolean;
  sortOrder: string;
  unit: string;
  options: FacetOptionRow[];
}

const emptyFacetForm = (): FacetFormState => ({
  code: "",
  name: "",
  valueType: "TEXT",
  isFilterable: true,
  sortOrder: "0",
  unit: "",
  options: [{ value: "", label: "", sortOrder: "0", swatchHex: "" }],
});

export function FacetsManager({
  facets,
  canDelete,
}: {
  facets: AdminFacetDTO[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FacetFormState>(emptyFacetForm);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<AdminFacetDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  function openNew() {
    setForm(emptyFacetForm());
    setFieldErrors({});
    setDialogOpen(true);
  }

  function openEdit(f: AdminFacetDTO) {
    setForm({
      id: f.id,
      code: f.code,
      name: f.name,
      valueType: f.valueType,
      isFilterable: f.isFilterable,
      sortOrder: String(f.sortOrder),
      unit: f.unit ?? "",
      options: f.options.map((o) => ({
        id: o.id,
        value: o.value,
        label: o.label,
        sortOrder: String(o.sortOrder),
        swatchHex: o.swatchHex ?? "",
      })),
    });
    setFieldErrors({});
    setDialogOpen(true);
  }

  function addOptionRow() {
    setForm((prev) => ({
      ...prev,
      options: [
        ...prev.options,
        {
          value: "",
          label: "",
          sortOrder: String(prev.options.length),
          swatchHex: "",
        },
      ],
    }));
  }

  function removeOptionRow(index: number) {
    setForm((prev) => ({
      ...prev,
      options: prev.options.filter((_, idx) => idx !== index),
    }));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const cleanedOptions = form.options
      .filter((o) => o.value.trim() || o.label.trim())
      .map((o, idx) => ({
        id: o.id,
        value: o.value.trim(),
        label: o.label.trim(),
        sortOrder: Number(o.sortOrder || String(idx)),
        swatchHex: o.swatchHex.trim() || null,
      }));

    const res = await upsertFacetAction({
      id: form.id,
      code: form.code,
      name: form.name,
      valueType: form.valueType,
      isFilterable: form.isFilterable,
      sortOrder: Number(form.sortOrder || "0"),
      unit: form.unit.trim() || null,
      options: cleanedOptions,
    });

    setSaving(false);

    if (!res.ok) {
      if (res.error.fieldErrors) setFieldErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      return;
    }

    toast.success(form.id ? "Attribute facet updated." : "Attribute facet created.");
    setDialogOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteFacetAction({ id: deleteTarget.id });
    setDeleting(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    toast.success(`Deleted attribute "${deleteTarget.name}".`);
    setDeleteTarget(null);
    router.refresh();
  }

  const columns: ResponsiveColumn<AdminFacetDTO>[] = [
    {
      key: "name",
      header: "Attribute",
      cell: (f) => (
        <div>
          <p className="font-medium text-foreground">{f.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{f.code}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (f) => <Badge variant="outline">{f.valueType}</Badge>,
    },
    {
      key: "options",
      header: "Options",
      cell: (f) => (
        <div className="flex flex-wrap gap-1">
          {f.options.length === 0 ? (
            <span className="text-xs text-muted-foreground">Freeform / numeric</span>
          ) : (
            f.options.slice(0, 4).map((o) => (
              <Badge key={o.id} variant="default">
                {o.label}
              </Badge>
            ))
          )}
          {f.options.length > 4 && (
            <span className="text-xs text-muted-foreground">+{f.options.length - 4} more</span>
          )}
        </div>
      ),
    },
    {
      key: "filterable",
      header: "Storefront Filter",
      cell: (f) => (
        <Badge variant={f.isFilterable ? "success" : "default"}>
          {f.isFilterable ? "Filterable" : "Hidden"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (f) => (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openEdit(f)}
            aria-label={`Edit facet ${f.name}`}
          >
            <Edit2 className="size-3.5" aria-hidden="true" />
            <span>Edit</span>
          </Button>
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setDeleteTarget(f)}
              aria-label={`Delete facet ${f.name}`}
            >
              <Trash2 className="size-4 text-destructive" aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-editorial-label text-accent-text">Collection Filters</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground">
            Attributes &amp; Facets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure jewellery specifications (Occasion, Setting Style, Chain Length) and
            selectable filter values.
          </p>
        </div>

        <Button type="button" onClick={openNew} className="gap-1.5">
          <Plus className="size-4" aria-hidden="true" />
          <span>New Attribute</span>
        </Button>
      </div>

      <ResponsiveDataTable
        data={facets}
        columns={columns}
        keyExtractor={(f) => f.id}
        mobileTitle={(f) => f.name}
        emptyState={
          <EmptyState
            icon={SlidersHorizontal}
            title="No Facet Attributes"
            description="Create structured jewellery attributes to power category filter sidebars."
            actionLabel="Create Attribute"
            onAction={openNew}
          />
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Attribute Facet" : "Create Attribute Facet"}</DialogTitle>
            <DialogDescription>
              Use lowercase alphanumeric codes with underscores (e.g., occasion, setting_style).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="facet-name"
                label="Display Name"
                required
                error={fieldErrors.name?.[0]}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Setting Style"
                    required
                  />
                )}
              </FormField>

              <FormField id="facet-code" label="System Code" required error={fieldErrors.code?.[0]}>
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
                      }))
                    }
                    placeholder="setting_style"
                    required
                  />
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="facet-type">Value Type</Label>
                <Select
                  value={form.valueType}
                  onValueChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      valueType: value as FacetFormState["valueType"],
                    }))
                  }
                >
                  <SelectTrigger id="facet-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Text / Options</SelectItem>
                    <SelectItem value="NUMBER">Number</SelectItem>
                    <SelectItem value="BOOLEAN">Boolean</SelectItem>
                    <SelectItem value="RANGE">Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <FormField id="facet-unit" label="Unit (Optional)" error={fieldErrors.unit?.[0]}>
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    placeholder="in, mm, ct"
                  />
                )}
              </FormField>

              <FormField id="facet-sort" label="Sort Order" error={fieldErrors.sortOrder?.[0]}>
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
              <div>
                <Label htmlFor="facet-filterable">Show in Collection Filter Sidebar</Label>
                <p className="text-xs text-muted-foreground">
                  Allow shoppers to filter listings by this attribute.
                </p>
              </div>
              <Switch
                id="facet-filterable"
                checked={form.isFilterable}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isFilterable: checked }))}
              />
            </div>

            <div className="space-y-3 rounded-sm border border-border bg-muted/25 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Selectable Options</p>
                  <p className="text-xs text-muted-foreground">
                    Leave empty for pure boolean/numeric attributes.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addOptionRow}>
                  <Plus className="size-3.5" aria-hidden="true" />
                  <span>Add Option</span>
                </Button>
              </div>

              <div className="space-y-2">
                {form.options.map((opt, idx) => (
                  <div
                    key={idx}
                    className="grid items-end gap-2 rounded-sm border border-border bg-card p-2.5 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-4">
                      <Label htmlFor={`opt-label-${idx}`} className="text-xs">
                        Label
                      </Label>
                      <Input
                        id={`opt-label-${idx}`}
                        value={opt.label}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.options];
                            next[idx] = { ...next[idx]!, label: e.target.value };
                            return { ...f, options: next };
                          })
                        }
                        placeholder="Pavé Halo"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <Label htmlFor={`opt-val-${idx}`} className="text-xs">
                        Value Slug
                      </Label>
                      <Input
                        id={`opt-val-${idx}`}
                        value={opt.value}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.options];
                            next[idx] = { ...next[idx]!, value: e.target.value };
                            return { ...f, options: next };
                          })
                        }
                        placeholder="pave-halo"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <Label htmlFor={`opt-swatch-${idx}`} className="text-xs">
                        Swatch Code
                      </Label>
                      <Input
                        id={`opt-swatch-${idx}`}
                        value={opt.swatchHex}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.options];
                            next[idx] = { ...next[idx]!, swatchHex: e.target.value };
                            return { ...f, options: next };
                          })
                        }
                        placeholder="Optional CSS color"
                      />
                    </div>

                    <div className="flex justify-end sm:col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOptionRow(idx)}
                        aria-label={`Remove option ${idx + 1}`}
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {form.id ? "Save Attribute" : "Create Attribute"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Attribute Facet"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}" and its option values from all linked products?`
            : ""
        }
        confirmLabel="Delete Attribute"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
