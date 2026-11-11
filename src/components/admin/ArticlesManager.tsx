"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Edit2, Eye, FileText, Plus, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { renderSafeMarkdown } from "@/lib/markdown";
import { deleteArticleAction, upsertArticleAction } from "@/modules/articles/article.actions";
import type { ArticleDTO } from "@/modules/articles/article.service";

interface ArticleFormState {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  bodyMarkdown: string;
  coverImageUrl: string;
  coverAltText: string;
  authorName: string;
  isPublished: boolean;
  seoTitle: string;
  seoDescription: string;
  relatedCategorySlug: string;
}

const emptyArticle = (): ArticleFormState => ({
  title: "",
  slug: "",
  excerpt: "",
  bodyMarkdown: "## Craftsmanship & Care\n\nWrite your jewellery education guide in Markdown.",
  coverImageUrl: "",
  coverAltText: "",
  authorName: "Maison Editorial Atelier",
  isPublished: false,
  seoTitle: "",
  seoDescription: "",
  relatedCategorySlug: "",
});

export function ArticlesManager({ articles }: { articles: ArticleDTO[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<ArticleFormState>(emptyArticle);
  const [previewHtml, setPreviewHtml] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<ArticleDTO | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function refreshPreview(markdown: string) {
    const html = await renderSafeMarkdown(markdown);
    setPreviewHtml(html);
  }

  function openNew() {
    const initial = emptyArticle();
    setForm(initial);
    setFieldErrors({});
    void refreshPreview(initial.bodyMarkdown);
    setDialogOpen(true);
  }

  function openEdit(a: ArticleDTO) {
    setForm({
      id: a.id,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      bodyMarkdown: a.bodyMarkdown,
      coverImageUrl: a.coverImageUrl ?? "",
      coverAltText: a.coverAltText ?? "",
      authorName: a.authorName,
      isPublished: a.isPublished,
      seoTitle: a.seoTitle ?? "",
      seoDescription: a.seoDescription ?? "",
      relatedCategorySlug: a.relatedCategorySlug ?? "",
    });
    setFieldErrors({});
    void refreshPreview(a.bodyMarkdown);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const res = await upsertArticleAction({
      id: form.id,
      title: form.title,
      slug: form.slug || undefined,
      excerpt: form.excerpt,
      bodyMarkdown: form.bodyMarkdown,
      coverImageUrl: form.coverImageUrl || null,
      coverAltText: form.coverAltText || null,
      authorName: form.authorName,
      isPublished: form.isPublished,
      seoTitle: form.seoTitle || null,
      seoDescription: form.seoDescription || null,
      relatedCategorySlug: form.relatedCategorySlug || null,
    });

    setSaving(false);

    if (!res.ok) {
      if (res.error.fieldErrors) setFieldErrors(res.error.fieldErrors);
      toast.error(res.error.message);
      return;
    }

    toast.success(form.id ? "Guide updated." : "Guide created.");
    setDialogOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteArticleAction({ id: deleteTarget.id });
    setDeleting(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    toast.success(`Deleted guide "${deleteTarget.title}".`);
    setDeleteTarget(null);
    router.refresh();
  }

  const columns: ResponsiveColumn<ArticleDTO>[] = [
    {
      key: "title",
      header: "Editorial Guide",
      cell: (a) => (
        <div>
          <p className="font-medium text-foreground">{a.title}</p>
          <p className="font-mono text-xs text-muted-foreground">/guides/{a.slug}</p>
        </div>
      ),
    },
    {
      key: "author",
      header: "Author",
      cell: (a) => a.authorName,
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => (
        <Badge variant={a.isPublished ? "success" : "outline"}>
          {a.isPublished ? "Published" : "Draft"}
        </Badge>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      cell: (a) => new Date(a.updatedAt).toLocaleDateString(),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (a) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(a)}>
            <Edit2 className="size-3.5" aria-hidden="true" />
            <span>Edit</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(a)}
            aria-label={`Delete guide ${a.title}`}
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
          <p className="text-editorial-label text-accent-text">Editorial &amp; Education</p>
          <h1 className="mt-1 font-display text-3xl font-medium text-foreground">
            Articles &amp; Buying Guides
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Author Markdown buying guides with sanitized live previews and automatic slug redirects.
          </p>
        </div>

        <Button type="button" onClick={openNew} className="gap-1.5">
          <Plus className="size-4" aria-hidden="true" />
          <span>New Guide</span>
        </Button>
      </div>

      <ResponsiveDataTable
        data={articles}
        columns={columns}
        keyExtractor={(a) => a.id}
        mobileTitle={(a) => a.title}
        emptyState={
          <EmptyState
            icon={FileText}
            title="No Guides Written"
            description="Create diamond education and jewellery care guides to build buyer trust."
            actionLabel="Write Guide"
            onAction={openNew}
          />
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Editorial Guide" : "New Editorial Guide"}</DialogTitle>
            <DialogDescription>
              Content is parsed cleanly via unified + remark-gfm and strictly sanitized before
              rendering.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="art-title"
                label="Article Title"
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
              <FormField
                id="art-slug"
                label="URL Slug"
                hint="Optional; defaults to slugified title"
                error={fieldErrors.slug?.[0]}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  />
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="art-author"
                label="Author / Studio Attribution"
                required
                error={fieldErrors.authorName?.[0]}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.authorName}
                    onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
                    required
                  />
                )}
              </FormField>
              <FormField id="art-cat" label="Related Category Path (Optional)">
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.relatedCategorySlug}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, relatedCategorySlug: e.target.value }))
                    }
                    placeholder="rings/engagement-rings"
                  />
                )}
              </FormField>
            </div>

            <FormField id="art-excerpt" label="Excerpt" required error={fieldErrors.excerpt?.[0]}>
              {(aria) => (
                <Textarea
                  {...aria}
                  rows={2}
                  value={form.excerpt}
                  onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                  required
                />
              )}
            </FormField>

            <ImageUploadField
              id="art-cover"
              folder="articles"
              label="Cover Photography"
              currentUrl={form.coverImageUrl}
              onUrlChange={(url) => setForm((f) => ({ ...f, coverImageUrl: url }))}
              onUploaded={(asset) => setForm((f) => ({ ...f, coverImageUrl: asset.url }))}
            />

            <FormField id="art-cover-alt" label="Cover Image Alt Text">
              {(aria) => (
                <Input
                  {...aria}
                  value={form.coverAltText}
                  onChange={(e) => setForm((f) => ({ ...f, coverAltText: e.target.value }))}
                />
              )}
            </FormField>

            <Tabs
              defaultValue="write"
              onValueChange={(tab) => {
                if (tab === "preview") {
                  void refreshPreview(form.bodyMarkdown);
                }
              }}
            >
              <TabsList>
                <TabsTrigger value="write">Markdown Editor</TabsTrigger>
                <TabsTrigger value="preview" className="gap-1.5">
                  <Eye className="size-3.5" aria-hidden="true" />
                  <span>Sanitized Preview</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="write">
                <FormField
                  id="art-md"
                  label="Markdown Body"
                  required
                  error={fieldErrors.bodyMarkdown?.[0]}
                >
                  {(aria) => (
                    <Textarea
                      {...aria}
                      rows={10}
                      className="font-mono text-xs"
                      value={form.bodyMarkdown}
                      onChange={(e) => setForm((f) => ({ ...f, bodyMarkdown: e.target.value }))}
                      required
                    />
                  )}
                </FormField>
              </TabsContent>
              <TabsContent value="preview">
                <div
                  className="min-h-48 space-y-3 rounded-sm border border-border bg-background p-4 text-sm leading-relaxed text-foreground [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-xl [&_h3]:font-display [&_h3]:text-lg [&_ul]:list-disc [&_ul]:pl-5"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </TabsContent>
            </Tabs>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="art-seo-t" label="SEO Title">
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.seoTitle}
                    onChange={(e) => setForm((f) => ({ ...f, seoTitle: e.target.value }))}
                  />
                )}
              </FormField>
              <FormField id="art-seo-d" label="SEO Description">
                {(aria) => (
                  <Input
                    {...aria}
                    value={form.seoDescription}
                    onChange={(e) => setForm((f) => ({ ...f, seoDescription: e.target.value }))}
                  />
                )}
              </FormField>
            </div>

            <div className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5">
              <Label htmlFor="art-pub" className="cursor-pointer">
                Published on Storefront (/guides)
              </Label>
              <Switch
                id="art-pub"
                checked={form.isPublished}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isPublished: v }))}
              />
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
                {form.id ? "Save Guide" : "Create Guide"}
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
        title="Delete Guide"
        description={deleteTarget ? `Delete editorial guide "${deleteTarget.title}"?` : ""}
        confirmLabel="Delete Guide"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
