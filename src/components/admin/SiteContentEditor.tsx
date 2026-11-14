"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import {
  resetSiteContentAction,
  saveSiteContentAction,
} from "@/modules/site-content/site-content.actions";
import {
  SITE_CONTENT_DEFAULTS,
  validateSiteContent,
  type JsonValue,
  type SiteContent,
} from "@/modules/site-content/site-content.shared";

type JsonObject = { [key: string]: JsonValue };
type Path = (string | number)[];

interface SectionDef {
  id: string;
  label: string;
  group: string;
  path: Path;
  href?: string;
}

const PAGE_LINKS: Record<string, string> = {
  home: "/",
  collections: "/collections",
  search: "/search",
  cart: "/cart",
  wishlist: "/wishlist",
  checkout: "/checkout",
  track: "/orders/track",
  contact: "/contact",
  guides: "/guides",
  newsletter: "/newsletter",
};

function humanize(key: string): string {
  const spaced = key
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bseo\b/i, "SEO")
    .replace(/\bcta\b/i, "CTA");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function buildSections(content: SiteContent): SectionDef[] {
  const sections: SectionDef[] = [];
  for (const key of Object.keys(content.site)) {
    // seoTemplates is file-only (read by SEO code at build/start); edit it in the JSON file.
    if (key.startsWith("_") || key === "seoTemplates") continue;
    sections.push({
      id: `site.${key}`,
      label: humanize(key),
      group: "Site-wide",
      path: ["site", key],
    });
  }
  for (const [key, value] of Object.entries(content.pages)) {
    if (key.startsWith("_")) continue;
    const nested = value as JsonObject;
    const children = Object.entries(nested).filter(([k]) => !k.startsWith("_"));
    const isGroup =
      !("seo" in nested) &&
      children.every(([, v]) => v && typeof v === "object" && "seo" in (v as JsonObject));
    if (isGroup) {
      for (const [sub] of children) {
        sections.push({
          id: `pages.${key}.${sub}`,
          label: humanize(sub),
          group: humanize(key),
          path: ["pages", key, sub],
        });
      }
    } else {
      sections.push({
        id: `pages.${key}`,
        label: humanize(key),
        group: "Pages",
        path: ["pages", key],
        href: PAGE_LINKS[key],
      });
    }
  }
  for (const key of Object.keys(content.ui)) {
    if (key.startsWith("_")) continue;
    sections.push({
      id: `ui.${key}`,
      label: humanize(key),
      group: "Interface text",
      path: ["ui", key],
    });
  }
  for (const key of Object.keys(content.editorial)) {
    if (key.startsWith("_")) continue;
    sections.push({
      id: `editorial.${key}`,
      label: humanize(key),
      group: "Info & legal pages",
      path: ["editorial", key],
      href: `/${key}`,
    });
  }
  return sections;
}

function getAt(root: JsonValue, path: Path): JsonValue {
  return path.reduce<JsonValue>((node, key) => (node as JsonObject)[key as string] ?? null, root);
}

function setAt(root: JsonValue, path: Path, value: JsonValue): JsonValue {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[head as number] = setAt(copy[head as number] ?? null, rest, value);
    return copy;
  }
  const obj = (root ?? {}) as JsonObject;
  return { ...obj, [head as string]: setAt(obj[head as string] ?? null, rest, value) };
}

/** Empty copy of an array item template, used for "Add item". */
function blankLike(template: JsonValue): JsonValue {
  if (typeof template === "string") return "";
  if (Array.isArray(template)) return [];
  if (template && typeof template === "object") {
    return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, blankLike(v)]));
  }
  return template;
}

function FieldEditor({
  label,
  value,
  defaultValue,
  path,
  onChange,
  root = false,
}: {
  label: string;
  value: JsonValue;
  defaultValue: JsonValue;
  path: Path;
  onChange: (path: Path, value: JsonValue) => void;
  /** The section itself: render its fields without an outer box. */
  root?: boolean;
}) {
  const id = `field-${path.join("-")}`;

  if (typeof value === "string") {
    const isBody = path[path.length - 1] === "body";
    const multiline = isBody || value.length > 90 || value.includes("\n");
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {multiline ? (
          <Textarea
            id={id}
            value={value}
            onChange={(e) => onChange(path, e.target.value)}
            rows={isBody ? 22 : 3}
            className={cn("text-sm", isBody && "font-mono text-[13px] leading-relaxed")}
          />
        ) : (
          <Input id={id} value={value} onChange={(e) => onChange(path, e.target.value)} />
        )}
        {isBody && (
          <p className="text-xs text-muted-foreground">
            Markdown: <code>## Heading</code>, <code>### Question</code>, <code>**bold**</code>,{" "}
            <code>[link](/page)</code>, blank line between paragraphs.
          </p>
        )}
      </div>
    );
  }

  if (Array.isArray(value)) {
    const template = Array.isArray(defaultValue) ? defaultValue[0] : undefined;
    return (
      <fieldset className="space-y-3 rounded-lg border border-border p-3 sm:p-4">
        <legend className="px-1 text-sm font-semibold">{label}</legend>
        {value.map((item, idx) => (
          <div key={idx} className="space-y-3 rounded-md border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Item {idx + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange(
                    path,
                    value.filter((_, i) => i !== idx),
                  )
                }
                aria-label={`Remove item ${idx + 1} from ${label}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
            <FieldEditor
              label={`${label} ${idx + 1}`}
              value={item}
              defaultValue={template ?? item}
              path={[...path, idx]}
              onChange={onChange}
            />
          </div>
        ))}
        {template !== undefined && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(path, [...value, blankLike(template)])}
          >
            <Plus className="size-4" aria-hidden="true" /> Add item
          </Button>
        )}
      </fieldset>
    );
  }

  if (value && typeof value === "object") {
    const defaults = (
      defaultValue && typeof defaultValue === "object" ? defaultValue : {}
    ) as JsonObject;
    // "_comment" / "_field" keys are notes from the JSON file: shown as help text, never editable.
    const notes = Object.entries(value).filter(
      ([key, child]) => key.startsWith("_") && typeof child === "string",
    );
    const noteFor = (key: string) => value[`_${key}`];
    const entries = Object.entries(value).filter(([key]) => !key.startsWith("_"));
    const body = (
      <div className="space-y-4">
        {notes
          .filter(([key]) => key === "_comment" || key === "_readme")
          .map(([key, note]) => (
            <p
              key={key}
              className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted-foreground"
            >
              {note as string}
            </p>
          ))}
        {entries.map(([key, child]) => (
          <div key={key} className="space-y-1">
            <FieldEditor
              key={key}
              label={humanize(key)}
              value={child}
              defaultValue={defaults[key] ?? child}
              path={[...path, key]}
              onChange={onChange}
            />
            {typeof noteFor(key) === "string" && (
              <p className="text-xs text-muted-foreground">{noteFor(key) as string}</p>
            )}
          </div>
        ))}
      </div>
    );
    if (root || typeof path[path.length - 1] === "number") return body;
    return (
      <fieldset className="space-y-4 rounded-lg border border-border p-3 sm:p-4">
        <legend className="px-1 text-sm font-semibold">{label}</legend>
        {body}
      </fieldset>
    );
  }

  return null;
}

export function SiteContentEditor({
  initialContent,
  hasOverride,
  updatedAt,
}: {
  initialContent: SiteContent;
  hasOverride: boolean;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [content, setContent] = React.useState<JsonValue>(initialContent as unknown as JsonValue);
  const [saved, setSaved] = React.useState<string>(() => JSON.stringify(initialContent));
  const [busy, setBusy] = React.useState<"save" | "reset" | null>(null);
  const [rawMode, setRawMode] = React.useState(false);
  const [rawText, setRawText] = React.useState("");
  const [rawError, setRawError] = React.useState<string | null>(null);
  const sections = React.useMemo(() => buildSections(initialContent), [initialContent]);
  const [activeId, setActiveId] = React.useState(sections[0]!.id);
  const active = sections.find((s) => s.id === activeId) ?? sections[0]!;
  const dirty = JSON.stringify(content) !== saved;

  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const sectionValue = getAt(content, active.path);
  const sectionDefault = getAt(SITE_CONTENT_DEFAULTS as unknown as JsonValue, active.path);

  function openSection(id: string) {
    setActiveId(id);
    setRawMode(false);
    setRawError(null);
  }

  function toggleRaw() {
    if (!rawMode) {
      setRawText(JSON.stringify(sectionValue, null, 2));
      setRawError(null);
    }
    setRawMode((v) => !v);
  }

  function applyRaw(text: string) {
    setRawText(text);
    try {
      const parsed = JSON.parse(text) as JsonValue;
      const next = setAt(content, active.path, parsed);
      const errors = validateSiteContent(next);
      if (errors.length > 0) {
        setRawError(errors.slice(0, 3).join("; "));
        return;
      }
      setRawError(null);
      setContent(next);
    } catch {
      setRawError("Not valid JSON yet.");
    }
  }

  async function save() {
    const errors = validateSiteContent(content);
    if (errors.length > 0) {
      void notifyError(errors.slice(0, 3).join("; "));
      return;
    }
    setBusy("save");
    const res = await saveSiteContentAction({ content: content as Record<string, unknown> });
    setBusy(null);
    if (!res.ok) {
      void notifyError(res.error.message);
      return;
    }
    setSaved(JSON.stringify(content));
    void notifySuccess("Page content saved. The storefront is updated.");
    router.refresh();
  }

  async function resetAll() {
    if (
      !window.confirm("Discard all saved edits and go back to the defaults in site-content.json?")
    ) {
      return;
    }
    setBusy("reset");
    const res = await resetSiteContentAction({});
    setBusy(null);
    if (!res.ok) {
      void notifyError(res.error.message);
      return;
    }
    const defaults = SITE_CONTENT_DEFAULTS as unknown as JsonValue;
    setContent(defaults);
    setSaved(JSON.stringify(defaults));
    void notifySuccess("Content reset to the file defaults.");
    router.refresh();
  }

  function download() {
    const blob = new Blob([`${JSON.stringify(content, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "site-content.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const groups = sections.reduce<Record<string, SectionDef[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium sm:text-3xl">Page Content</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Text and SEO for every storefront page. Defaults come from{" "}
            <code className="text-xs">data/frontend/site-content.json</code>; saving here overrides
            them. Use {"{{siteName}}"}, {"{{contactEmail}}"}, {"{{returnWindowDays}}"} to insert
            store settings.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={hasOverride ? "primary" : "outline"}>
              {hasOverride ? "Edited in admin" : "Using file defaults"}
            </Badge>
            {updatedAt && <span>Last saved {new Date(updatedAt).toLocaleString("en-US")}</span>}
            {dirty && <Badge variant="warning">Unsaved changes</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={download}>
            <Download className="size-4" aria-hidden="true" /> Download JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void resetAll()}
            disabled={busy !== null || !hasOverride}
          >
            {busy === "reset" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="size-4" aria-hidden="true" />
            )}
            Reset to defaults
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void save()}
            disabled={!dirty || busy !== null}
          >
            {busy === "save" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            Save changes
          </Button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-12">
        <nav aria-label="Content sections" className="lg:col-span-3">
          <label htmlFor="content-section" className="sr-only">
            Section
          </label>
          <select
            id="content-section"
            value={activeId}
            onChange={(e) => openSection(e.target.value)}
            className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm lg:hidden"
          >
            {Object.entries(groups).map(([group, items]) => (
              <optgroup key={group} label={group}>
                {items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="hidden space-y-4 lg:block">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <p className="mb-1 px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {items.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => openSection(s.id)}
                        aria-current={s.id === activeId ? "page" : undefined}
                        className={cn(
                          "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          s.id === activeId
                            ? "bg-accent-tint font-medium text-foreground"
                            : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                        )}
                      >
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <section className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6 lg:col-span-9">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {active.group} · {active.label}
            </h2>
            <div className="flex gap-2">
              {active.href && (
                <Button asChild variant="ghost" size="sm">
                  <Link href={active.href} target="_blank" rel="noopener noreferrer">
                    View page <ExternalLink className="size-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={toggleRaw}>
                {rawMode ? "Form view" : "Edit as JSON"}
              </Button>
            </div>
          </div>

          {rawMode ? (
            <div className="space-y-2">
              <Textarea
                aria-label={`${active.label} as JSON`}
                value={rawText}
                onChange={(e) => applyRaw(e.target.value)}
                rows={28}
                spellCheck={false}
                className="font-mono text-[13px] leading-relaxed"
              />
              <p className={cn("text-xs", rawError ? "text-destructive" : "text-muted-foreground")}>
                {rawError ?? "Valid. Changes apply to the form; press Save changes to publish."}
              </p>
            </div>
          ) : (
            <FieldEditor
              label={active.label}
              value={sectionValue}
              defaultValue={sectionDefault}
              path={active.path}
              root
              onChange={(path, value) => setContent((prev) => setAt(prev, path, value))}
            />
          )}
        </section>
      </div>
    </div>
  );
}
