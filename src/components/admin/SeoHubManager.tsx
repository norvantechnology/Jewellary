"use client";

import { LocalDate } from "@/components/shared/LocalDate";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Download,
  ExternalLink,
  Layers,
  Play,
  Plus,
  Route as RouteIcon,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_SEO_TEMPLATES } from "@/lib/seo/templates";
import {
  deleteLandingFacetAction,
  deleteRedirectRuleAction,
  importRedirectsCsvAction,
  resolveNotFoundLogAction,
  runSeoAuditAction,
  updateBulkSeoBatchAction,
  updateGlobalSeoConfigAction,
  updateSeoTemplatesAction,
  upsertLandingFacetAction,
  upsertRedirectRuleAction,
  upsertStaticPageSeoAction,
} from "@/modules/seo/seo.actions";
import type {
  BulkSeoItemDTO,
  LandingFacetDTO,
  RedirectRuleDTO,
  SlugRedirectDTO,
  StaticPageSeoDTO,
} from "@/modules/seo/seo.service";
import type { PublicStoreSettings } from "@/modules/settings/settings.service";

interface AuditIssueView {
  url: string;
  entityType: string;
  entityId: string;
  severity: "error" | "warning";
  code: string;
  message: string;
}

interface SeoHubManagerProps {
  settings: PublicStoreSettings;
  categories: Array<{ name: string; path: string }>;
  latestAudit: {
    id: string;
    score: number;
    totalUrls: number;
    passedCount: number;
    warningCount: number;
    errorCount: number;
    createdAt: string;
    summary: Record<string, unknown>;
    issues: AuditIssueView[];
  } | null;
  aiBotSummary: Array<{ botName: string; botGroup: string; hitsLast30d: number }>;
  landingFacets: LandingFacetDTO[];
  staticPages: StaticPageSeoDTO[];
  redirects: {
    rules: RedirectRuleDTO[];
    slugRedirects: SlugRedirectDTO[];
    notFoundLogs: Array<{
      id: string;
      path: string;
      referrer: string | null;
      userAgent: string | null;
      hits: number;
      firstSeenAt: string;
      lastSeenAt: string;
      resolved: boolean;
    }>;
  };
  bulkItems: BulkSeoItemDTO[];
}

const DEFAULT_AI_CHECKLIST: Record<string, boolean> = {
  llmsTxtLive: true,
  robotsAllowsOaiPerplexityClaude: true,
  ssrJsonLdComplete: true,
  authorCredentialsPopulated: true,
  indexNowConfigured: false,
  merchantFeedSubmitted: false,
};

const AI_CHECKLIST_LABELS: Array<{ key: string; label: string; link?: string }> = [
  { key: "llmsTxtLive", label: "/llms.txt & /llms-full.txt published", link: "/llms.txt" },
  {
    key: "robotsAllowsOaiPerplexityClaude",
    label: "robots.txt permits OAI-SearchBot, PerplexityBot & Claude-SearchBot",
    link: "/robots.txt",
  },
  {
    key: "ssrJsonLdComplete",
    label: "SSR ProductGroup, Organization, Article & BreadcrumbList validated",
  },
  {
    key: "authorCredentialsPopulated",
    label: "Gemologist author credentials & E-E-A-T bio filled on guides",
    link: "/admin/articles",
  },
  { key: "indexNowConfigured", label: "IndexNow key verified & pinging on publish" },
  {
    key: "merchantFeedSubmitted",
    label: "Google Merchant Center XML feed linked & scheduled",
    link: "/feeds/google-merchant.xml",
  },
];

export function SeoHubManager({
  settings,
  categories,
  latestAudit,
  aiBotSummary,
  landingFacets,
  staticPages,
  redirects,
  bulkItems,
}: SeoHubManagerProps) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  // ─── 1. Audit State ──────────────────────────────────────────────────────────
  const [issueFilter, setIssueFilter] = React.useState<"all" | "error" | "warning">("all");
  const filteredIssues = (latestAudit?.issues ?? []).filter(
    (issue) => issueFilter === "all" || issue.severity === issueFilter,
  );

  async function handleRunAudit(checkImagesHttp: boolean) {
    setBusy(true);
    try {
      const res = await runSeoAuditAction({ checkImagesHttp });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        `Audit complete — Score ${res.data.score}/100 (${res.data.errorCount} errors, ${res.data.warningCount} warnings)`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // ─── 2. Redirects & 404 Log State ────────────────────────────────────────────
  const [redirectForm, setRedirectForm] = React.useState({
    fromPath: "",
    toPath: "",
    statusCode: 301,
    note: "",
    isActive: true,
  });
  const [csvImportText, setCsvImportText] = React.useState("");

  async function handleSaveRedirect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await upsertRedirectRuleAction({
        fromPath: redirectForm.fromPath,
        toPath: redirectForm.statusCode === 410 ? null : redirectForm.toPath || null,
        statusCode: redirectForm.statusCode,
        note: redirectForm.note || null,
        isActive: redirectForm.isActive,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Saved redirect for ${res.data.fromPath}`);
      setRedirectForm({ fromPath: "", toPath: "", statusCode: 301, note: "", isActive: true });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRedirect(id: string) {
    setBusy(true);
    try {
      const res = await deleteRedirectRuleAction({ id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Redirect rule deleted.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleImportCsv() {
    if (!csvImportText.trim()) return;
    setBusy(true);
    try {
      const res = await importRedirectsCsvAction({ csvText: csvImportText });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        `Imported ${res.data.imported} redirects${res.data.skipped.length ? ` (${res.data.skipped.length} skipped)` : ""}.`,
      );
      setCsvImportText("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve404(id: string) {
    const res = await resolveNotFoundLogAction({ id });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    router.refresh();
  }

  // ─── 3. Bulk SEO Editor State ────────────────────────────────────────────────
  const [bulkSearch, setBulkSearch] = React.useState("");
  const [bulkType, setBulkType] = React.useState<"all" | "product" | "category" | "article">("all");
  const [bulkEdits, setBulkEdits] = React.useState<
    Record<
      string,
      {
        entityType: "product" | "category" | "article";
        id: string;
        seoTitle: string;
        seoDescription: string;
        seoKeywords: string;
        noindex: boolean;
      }
    >
  >({});

  const visibleBulkItems = React.useMemo(() => {
    const q = bulkSearch.trim().toLowerCase();
    return bulkItems
      .filter((item) => bulkType === "all" || item.entityType === bulkType)
      .filter(
        (item) =>
          !q ||
          item.name.toLowerCase().includes(q) ||
          item.url.toLowerCase().includes(q) ||
          (item.seoTitle ?? "").toLowerCase().includes(q),
      )
      .slice(0, 80);
  }, [bulkItems, bulkSearch, bulkType]);

  function updateBulkRow(
    item: BulkSeoItemDTO,
    patch: Partial<{
      seoTitle: string;
      seoDescription: string;
      seoKeywords: string;
      noindex: boolean;
    }>,
  ) {
    const key = `${item.entityType}:${item.id}`;
    setBulkEdits((prev) => {
      const base = prev[key] ?? {
        entityType: item.entityType,
        id: item.id,
        seoTitle: item.seoTitle ?? "",
        seoDescription: item.seoDescription ?? "",
        seoKeywords: item.seoKeywords ?? "",
        noindex: item.noindex,
      };
      return { ...prev, [key]: { ...base, ...patch } };
    });
  }

  async function handleSaveBulkBatch() {
    const updates = Object.values(bulkEdits).map((entry) => ({
      entityType: entry.entityType,
      id: entry.id,
      seoTitle: entry.seoTitle || null,
      seoDescription: entry.seoDescription || null,
      seoKeywords: entry.seoKeywords || null,
      canonicalOverride: null,
      noindex: entry.noindex,
    }));
    if (updates.length === 0) return;

    setBusy(true);
    try {
      const res = await updateBulkSeoBatchAction({ updates });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Updated SEO metadata on ${res.data.updatedCount} items & pinged IndexNow.`);
      setBulkEdits({});
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // ─── 4. Templates & Global Config State ──────────────────────────────────────
  const [templatesForm, setTemplatesForm] = React.useState({
    productTitle: settings.seoTemplates?.productTitle ?? DEFAULT_SEO_TEMPLATES.productTitle,
    productDescription:
      settings.seoTemplates?.productDescription ?? DEFAULT_SEO_TEMPLATES.productDescription,
    collectionTitle:
      settings.seoTemplates?.collectionTitle ?? DEFAULT_SEO_TEMPLATES.collectionTitle,
    collectionDescription:
      settings.seoTemplates?.collectionDescription ?? DEFAULT_SEO_TEMPLATES.collectionDescription,
  });

  const [globalConfigForm, setGlobalConfigForm] = React.useState({
    legalName: settings.legalName ?? "",
    seoDefaultTitlePattern: settings.seoDefaultTitlePattern ?? "",
    seoDefaultDescription: settings.seoDefaultDescription ?? "",
    defaultOgImageUrl: settings.defaultOgImageUrl ?? "",
    allowAiCrawlers: settings.allowAiCrawlers,
    canonicalHost: settings.seoSettings?.canonicalHost ?? "",
    trailingSlashPolicy:
      (settings.seoSettings?.trailingSlashPolicy as "remove" | "preserve") ?? "remove",
    indexNowKey: settings.seoSettings?.indexNowKey ?? "",
    indexNowEnabled: Boolean(settings.seoSettings?.indexNowEnabled),
    googleSiteVerification: settings.seoSettings?.googleSiteVerification ?? "",
    bingSiteVerification: settings.seoSettings?.bingSiteVerification ?? "",
    pinterestVerification: settings.seoSettings?.pinterestVerification ?? "",
    defaultGoogleProductCategory:
      settings.seoSettings?.defaultGoogleProductCategory ?? "Apparel & Accessories > Jewelry",
    aiVisibilityChecklist: {
      ...DEFAULT_AI_CHECKLIST,
      ...(settings.seoSettings?.aiVisibilityChecklist ?? {}),
    },
  });

  async function handleSaveTemplates(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await updateSeoTemplatesAction({
        ...DEFAULT_SEO_TEMPLATES,
        ...settings.seoTemplates,
        ...templatesForm,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("SEO templates saved & storefront metadata revalidated.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveGlobalConfig(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await updateGlobalSeoConfigAction({
        ...globalConfigForm,
        maintenanceMode: Boolean(settings.seoSettings?.maintenanceMode),
        maintenanceRetryAfterSeconds: settings.seoSettings?.maintenanceRetryAfterSeconds ?? 3600,
        customRobotsDisallow: settings.seoSettings?.customRobotsDisallow ?? [],
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Global SEO configuration updated.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // ─── 5. Landing Facets State ─────────────────────────────────────────────────
  const [facetForm, setFacetForm] = React.useState({
    categoryPath: categories[0]?.path ?? "rings",
    facetSlug: "",
    name: "",
    h1: "",
    introCopy: "",
    seoTitle: "",
    seoDescription: "",
    metalCsv: "",
    shapeCsv: "",
    certCsv: "",
    isActive: true,
    noindex: false,
  });

  async function handleSaveFacet(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const splitCsv = (s: string) =>
        s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      const res = await upsertLandingFacetAction({
        categoryPath: facetForm.categoryPath,
        facetSlug: facetForm.facetSlug,
        name: facetForm.name,
        h1: facetForm.h1,
        introCopy: facetForm.introCopy || null,
        seoTitle: facetForm.seoTitle || null,
        seoDescription: facetForm.seoDescription || null,
        filterParams: {
          ...(facetForm.metalCsv ? { metal: splitCsv(facetForm.metalCsv) } : {}),
          ...(facetForm.shapeCsv ? { shape: splitCsv(facetForm.shapeCsv) } : {}),
          ...(facetForm.certCsv ? { certification: splitCsv(facetForm.certCsv) } : {}),
        },
        isActive: facetForm.isActive,
        noindex: facetForm.noindex,
        sortOrder: 0,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Landing facet created at ${res.data.url}`);
      setFacetForm((prev) => ({
        ...prev,
        facetSlug: "",
        name: "",
        h1: "",
        introCopy: "",
        seoTitle: "",
        seoDescription: "",
        metalCsv: "",
        shapeCsv: "",
        certCsv: "",
      }));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteFacet(id: string) {
    setBusy(true);
    try {
      const res = await deleteLandingFacetAction({ id });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Landing facet removed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // ─── 6. Static Page SEO State ────────────────────────────────────────────────
  const [selectedStaticSlug, setSelectedStaticSlug] = React.useState(staticPages[0]?.slug ?? "/");
  const selectedStatic = staticPages.find((p) => p.slug === selectedStaticSlug) ?? staticPages[0];
  const [staticForm, setStaticForm] = React.useState({
    label: selectedStatic?.label ?? "Homepage",
    seoTitle: selectedStatic?.seoTitle ?? "",
    seoDescription: selectedStatic?.seoDescription ?? "",
    seoKeywords: selectedStatic?.seoKeywords ?? "",
    canonicalOverride: selectedStatic?.canonicalOverride ?? "",
    noindex: selectedStatic?.noindex ?? false,
  });

  function handleSelectStaticSlug(nextSlug: string) {
    setSelectedStaticSlug(nextSlug);
    const found = staticPages.find((p) => p.slug === nextSlug);
    if (found) {
      setStaticForm({
        label: found.label,
        seoTitle: found.seoTitle ?? "",
        seoDescription: found.seoDescription ?? "",
        seoKeywords: found.seoKeywords ?? "",
        canonicalOverride: found.canonicalOverride ?? "",
        noindex: found.noindex,
      });
    }
  }

  async function handleSaveStaticPage(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await upsertStaticPageSeoAction({
        slug: selectedStaticSlug,
        label: staticForm.label,
        seoTitle: staticForm.seoTitle || null,
        seoDescription: staticForm.seoDescription || null,
        seoKeywords: staticForm.seoKeywords || null,
        canonicalOverride: staticForm.canonicalOverride || null,
        noindex: staticForm.noindex,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Saved SEO overrides for ${selectedStaticSlug}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const totalAiHits = aiBotSummary.reduce((sum, item) => sum + item.hitsLast30d, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="type-h1 font-display font-semibold text-foreground">
            SEO, Schema &amp; AI Search Hub
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor crawl health, manage 301/410 redirects &amp; 404 logs, edit bulk metadata,
            curate landing facets, and track AI retrieval crawlers.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/sitemap.xml" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 size-4" />
              Sitemap Index
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/llms.txt" target="_blank" rel="noreferrer">
              <Bot className="mr-1.5 size-4" />
              /llms.txt
            </a>
          </Button>
          <Button size="sm" disabled={busy} onClick={() => handleRunAudit(false)}>
            <Play className="mr-1.5 size-4" />
            Run Site Audit
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Audit Score</CardDescription>
            <CardTitle className="font-mono text-2xl">
              {latestAudit ? `${latestAudit.score}/100` : "Not run"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Errors / Warnings</CardDescription>
            <CardTitle className="font-mono text-2xl">
              {latestAudit ? `${latestAudit.errorCount} / ${latestAudit.warningCount}` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Redirects</CardDescription>
            <CardTitle className="font-mono text-2xl">
              {redirects.rules.filter((r) => r.isActive).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unresolved 404s</CardDescription>
            <CardTitle className="font-mono text-2xl">
              {redirects.notFoundLogs.filter((l) => !l.resolved).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bot / AI Hits (30d)</CardDescription>
            <CardTitle className="font-mono text-2xl">{totalAiHits}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="audit">Audit &amp; AI Visibility</TabsTrigger>
          <TabsTrigger value="redirects">Redirects &amp; 404 Log</TabsTrigger>
          <TabsTrigger value="bulk">Bulk SEO Editor</TabsTrigger>
          <TabsTrigger value="templates">Templates &amp; Global Config</TabsTrigger>
          <TabsTrigger value="facets">Landing Facets</TabsTrigger>
          <TabsTrigger value="static">Static Pages</TabsTrigger>
        </TabsList>

        {/* 1. AUDIT & AI VISIBILITY TAB */}
        <TabsContent value="audit" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Search className="size-4 text-accent-text" />
                    Technical &amp; On-Page SEO Audit
                  </CardTitle>
                  <CardDescription>
                    {latestAudit ? (
                      <>
                        Last run <LocalDate value={latestAudit.createdAt} withTime /> across{" "}
                        {latestAudit.totalUrls} URLs.
                      </>
                    ) : (
                      "Run a site audit to scan products, categories, guides, images, and duplicate metadata."
                    )}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <NativeSelect
                    value={issueFilter}
                    onChange={(e) => setIssueFilter(e.target.value as "all" | "error" | "warning")}
                    className="h-9 w-36"
                  >
                    <option value="all">All Issues</option>
                    <option value="error">Errors Only</option>
                    <option value="warning">Warnings Only</option>
                  </NativeSelect>
                  <Button asChild variant="outline" size="sm">
                    <a href="/api/admin/seo/export?kind=audit">
                      <Download className="mr-1.5 size-4" />
                      Export CSV
                    </a>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {filteredIssues.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span>No flagged SEO issues matching this filter.</span>
                  </div>
                ) : (
                  <div className="max-h-[460px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                    {filteredIssues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={issue.severity === "error" ? "destructive" : "warning"}>
                              {issue.code}
                            </Badge>
                            <Link
                              href={issue.url}
                              target="_blank"
                              className="font-mono text-xs text-accent-text hover:underline"
                            >
                              {issue.url}
                            </Link>
                          </div>
                          <p className="text-muted-foreground">{issue.message}</p>
                        </div>
                        <span className="text-xs text-muted-foreground uppercase">
                          {issue.entityType}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="size-4 text-accent-text" />
                  AI Search Readiness
                </CardTitle>
                <CardDescription>Crawler hits (last 30d) &amp; readiness checklist</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Crawler Hits Logged
                  </p>
                  {aiBotSummary.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No search or AI crawler visits recorded yet. Run `check-ai-bots.ts` or wait
                      for crawlers.
                    </p>
                  ) : (
                    <ul className="space-y-1.5 text-sm">
                      {aiBotSummary.map((row) => (
                        <li key={`${row.botName}-${row.botGroup}`} className="flex justify-between">
                          <span className="font-medium">{row.botName}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {row.hitsLast30d} hits ({row.botGroup})
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-2.5">
                  {AI_CHECKLIST_LABELS.map((item) => (
                    <label key={item.key} className="flex items-start gap-2.5 text-xs">
                      <Checkbox
                        checked={Boolean(globalConfigForm.aiVisibilityChecklist[item.key])}
                        onCheckedChange={(checked) =>
                          setGlobalConfigForm((prev) => ({
                            ...prev,
                            aiVisibilityChecklist: {
                              ...prev.aiVisibilityChecklist,
                              [item.key]: Boolean(checked),
                            },
                          }))
                        }
                      />
                      <span className="leading-snug text-foreground">
                        {item.label}{" "}
                        {item.link && (
                          <Link
                            href={item.link}
                            target="_blank"
                            className="text-accent-text underline"
                          >
                            Verify
                          </Link>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. REDIRECTS & 404 LOG TAB */}
        <TabsContent value="redirects" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RouteIcon className="size-4 text-accent-text" />
                  Create 301 / 410 Redirect Rule
                </CardTitle>
                <CardDescription>
                  Loop &amp; chain detection runs automatically before saving.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveRedirect} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="redir-from">From Path</Label>
                      <Input
                        id="redir-from"
                        placeholder="/old-ring-url"
                        value={redirectForm.fromPath}
                        onChange={(e) =>
                          setRedirectForm((f) => ({ ...f, fromPath: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="redir-code">HTTP Code</Label>
                      <NativeSelect
                        id="redir-code"
                        value={String(redirectForm.statusCode)}
                        onChange={(e) =>
                          setRedirectForm((f) => ({ ...f, statusCode: Number(e.target.value) }))
                        }
                      >
                        <option value="301">301 Moved Permanently</option>
                        <option value="302">302 Temporary</option>
                        <option value="308">308 Permanent</option>
                        <option value="410">410 Permanently Removed (Gone)</option>
                      </NativeSelect>
                    </div>
                  </div>
                  {redirectForm.statusCode !== 410 && (
                    <div>
                      <Label htmlFor="redir-to">Destination Path or URL</Label>
                      <Input
                        id="redir-to"
                        placeholder="/collections/rings"
                        value={redirectForm.toPath}
                        onChange={(e) => setRedirectForm((f) => ({ ...f, toPath: e.target.value }))}
                        required
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="redir-note">Note (optional)</Label>
                    <Input
                      id="redir-note"
                      placeholder="Merged collection or discontinued piece"
                      value={redirectForm.note}
                      onChange={(e) => setRedirectForm((f) => ({ ...f, note: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={busy}>
                      <Plus className="mr-1.5 size-4" />
                      Save Redirect Rule
                    </Button>
                    <Button asChild type="button" variant="outline">
                      <a href="/api/admin/seo/export?kind=redirects">
                        <Download className="mr-1.5 size-4" />
                        Export CSV
                      </a>
                    </Button>
                  </div>
                </form>

                <div className="mt-6 space-y-2 border-t border-border pt-4">
                  <Label htmlFor="redir-csv">Bulk CSV Import (from,to,code,note)</Label>
                  <Textarea
                    id="redir-csv"
                    rows={3}
                    placeholder="/legacy-page,/collections/rings,301,Migration"
                    value={csvImportText}
                    onChange={(e) => setCsvImportText(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || !csvImportText.trim()}
                    onClick={handleImportCsv}
                  >
                    <Upload className="mr-1.5 size-4" />
                    Import CSV Rules
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="size-4 text-amber-600" />
                  Top 404 Not Found URLs
                </CardTitle>
                <CardDescription>
                  Click Create 301 to turn a frequent missing path into a permanent redirect.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {redirects.notFoundLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No 404 hits logged yet.</p>
                ) : (
                  <div className="max-h-[420px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                    {redirects.notFoundLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between gap-3 p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-medium">{log.path}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.hits} hits · last <LocalDate value={log.lastSeenAt} />
                            {log.resolved ? " · Resolved" : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setRedirectForm((f) => ({
                                ...f,
                                fromPath: log.path,
                                statusCode: 301,
                                note: "Fixed from 404 log",
                              }))
                            }
                          >
                            Create 301
                          </Button>
                          {!log.resolved && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleResolve404(log.id)}
                            >
                              Dismiss
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Active Redirect Rules ({redirects.rules.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {redirects.rules.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No manual redirect rules configured.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {redirects.rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-medium">{rule.fromPath}</span>{" "}
                        <span className="text-muted-foreground">→</span>{" "}
                        <span className="font-mono text-xs text-accent-text">
                          {rule.statusCode === 410 ? "[410 GONE]" : rule.toPath}
                        </span>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          HTTP {rule.statusCode} · {rule.hits} hits
                          {rule.note ? ` · ${rule.note}` : ""}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => handleDeleteRedirect(rule.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. BULK SEO EDITOR TAB */}
        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Bulk Metadata Editor</CardTitle>
                <CardDescription>
                  Edit SEO titles (≤60 chars), meta descriptions (120–158 chars), keywords, and
                  noindex across products, categories, and guides.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href="/api/admin/seo/export?kind=bulk">
                    <Download className="mr-1.5 size-4" />
                    Export CSV
                  </a>
                </Button>
                <Button
                  size="sm"
                  disabled={busy || Object.keys(bulkEdits).length === 0}
                  onClick={handleSaveBulkBatch}
                >
                  <Save className="mr-1.5 size-4" />
                  Save {Object.keys(bulkEdits).length} Edits
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Input
                  placeholder="Filter by title or URL..."
                  value={bulkSearch}
                  onChange={(e) => setBulkSearch(e.target.value)}
                  className="max-w-sm"
                />
                <NativeSelect
                  value={bulkType}
                  onChange={(e) =>
                    setBulkType(e.target.value as "all" | "product" | "category" | "article")
                  }
                  className="w-40"
                >
                  <option value="all">All Entities</option>
                  <option value="product">Products</option>
                  <option value="category">Categories</option>
                  <option value="article">Guides</option>
                </NativeSelect>
              </div>

              <div className="divide-y divide-border rounded-lg border border-border">
                {visibleBulkItems.map((item) => {
                  const key = `${item.entityType}:${item.id}`;
                  const edited = bulkEdits[key];
                  const titleVal = edited?.seoTitle ?? item.seoTitle ?? "";
                  const descVal = edited?.seoDescription ?? item.seoDescription ?? "";
                  const kwVal = edited?.seoKeywords ?? item.seoKeywords ?? "";
                  const noindexVal = edited?.noindex ?? item.noindex;

                  return (
                    <div key={key} className="grid gap-3 p-4 lg:grid-cols-12">
                      <div className="lg:col-span-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="uppercase">
                            {item.entityType}
                          </Badge>
                          <Badge variant={item.score >= 80 ? "success" : "warning"}>
                            {item.score}/100
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium text-foreground">{item.name}</p>
                        <Link
                          href={item.url}
                          target="_blank"
                          className="font-mono text-xs text-accent-text hover:underline"
                        >
                          {item.url}
                        </Link>
                      </div>
                      <div className="space-y-2 lg:col-span-4">
                        <Label className="text-xs">
                          SEO Title ({titleVal.length || item.resolvedTitle.length}/60)
                        </Label>
                        <Input
                          value={titleVal}
                          placeholder={item.resolvedTitle}
                          onChange={(e) => updateBulkRow(item, { seoTitle: e.target.value })}
                        />
                        <Label className="text-xs">Keywords</Label>
                        <Input
                          value={kwVal}
                          placeholder="emerald cut engagement ring, platinum"
                          onChange={(e) => updateBulkRow(item, { seoKeywords: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 lg:col-span-4">
                        <Label className="text-xs">
                          Meta Description ({descVal.length || item.resolvedDescription.length}/158)
                        </Label>
                        <Textarea
                          rows={3}
                          value={descVal}
                          placeholder={item.resolvedDescription}
                          onChange={(e) => updateBulkRow(item, { seoDescription: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-2 lg:col-span-1">
                        <Checkbox
                          id={`noindex-${key}`}
                          checked={noindexVal}
                          onCheckedChange={(checked) =>
                            updateBulkRow(item, { noindex: Boolean(checked) })
                          }
                        />
                        <Label htmlFor={`noindex-${key}`} className="text-xs">
                          Noindex
                        </Label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. TEMPLATES & GLOBAL CONFIG TAB */}
        <TabsContent value="templates" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-4 text-accent-text" />
                Dynamic Title &amp; Description Templates
              </CardTitle>
              <CardDescription>
                Variables:{" "}
                <code>
                  {"{name} {category} {collection} {metal} {carat} {cert} {brand} {price} {page}"}
                </code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveTemplates} className="space-y-3">
                <div>
                  <Label>Product Title Pattern</Label>
                  <Input
                    value={templatesForm.productTitle}
                    onChange={(e) =>
                      setTemplatesForm((t) => ({ ...t, productTitle: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Product Description Pattern</Label>
                  <Textarea
                    rows={2}
                    value={templatesForm.productDescription}
                    onChange={(e) =>
                      setTemplatesForm((t) => ({ ...t, productDescription: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Collection Title Pattern</Label>
                  <Input
                    value={templatesForm.collectionTitle}
                    onChange={(e) =>
                      setTemplatesForm((t) => ({ ...t, collectionTitle: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Collection Description Pattern</Label>
                  <Textarea
                    rows={2}
                    value={templatesForm.collectionDescription}
                    onChange={(e) =>
                      setTemplatesForm((t) => ({ ...t, collectionDescription: e.target.value }))
                    }
                  />
                </div>
                <Button type="submit" disabled={busy}>
                  <Save className="mr-1.5 size-4" />
                  Save Templates
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Global Verification, IndexNow &amp; Schema</CardTitle>
              <CardDescription>
                Organization legal name, verification tokens, and IndexNow settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveGlobalConfig} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Legal Entity Name</Label>
                    <Input
                      value={globalConfigForm.legalName}
                      placeholder="Your registered company name"
                      onChange={(e) =>
                        setGlobalConfigForm((c) => ({ ...c, legalName: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>IndexNow Key</Label>
                    <Input
                      value={globalConfigForm.indexNowKey}
                      placeholder="32-char hex key"
                      onChange={(e) =>
                        setGlobalConfigForm((c) => ({ ...c, indexNowKey: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Google Verification</Label>
                    <Input
                      value={globalConfigForm.googleSiteVerification}
                      onChange={(e) =>
                        setGlobalConfigForm((c) => ({
                          ...c,
                          googleSiteVerification: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Bing Verification</Label>
                    <Input
                      value={globalConfigForm.bingSiteVerification}
                      onChange={(e) =>
                        setGlobalConfigForm((c) => ({
                          ...c,
                          bingSiteVerification: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Pinterest Verification</Label>
                    <Input
                      value={globalConfigForm.pinterestVerification}
                      onChange={(e) =>
                        setGlobalConfigForm((c) => ({
                          ...c,
                          pinterestVerification: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-6 pt-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="seo-cfg-allow-ai"
                      checked={globalConfigForm.allowAiCrawlers}
                      onCheckedChange={(checked) =>
                        setGlobalConfigForm((c) => ({ ...c, allowAiCrawlers: Boolean(checked) }))
                      }
                    />
                    <Label htmlFor="seo-cfg-allow-ai" className="cursor-pointer font-normal">
                      Allow AI training bots (GPTBot/ClaudeBot)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="seo-cfg-indexnow"
                      checked={globalConfigForm.indexNowEnabled}
                      onCheckedChange={(checked) =>
                        setGlobalConfigForm((c) => ({ ...c, indexNowEnabled: Boolean(checked) }))
                      }
                    />
                    <Label htmlFor="seo-cfg-indexnow" className="cursor-pointer font-normal">
                      Enable IndexNow ping on save
                    </Label>
                  </div>
                </div>
                <Button type="submit" disabled={busy}>
                  <Save className="mr-1.5 size-4" />
                  Save Global Config
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. LANDING FACETS TAB */}
        <TabsContent value="facets" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="size-4 text-accent-text" />
                Create Indexable Landing Facet
              </CardTitle>
              <CardDescription>
                Expose static high-intent collection facets like{" "}
                <code>/collections/rings/platinum</code> with unique H1, copy, and sitemap entry.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveFacet} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Parent Category</Label>
                    <NativeSelect
                      value={facetForm.categoryPath}
                      onChange={(e) =>
                        setFacetForm((f) => ({ ...f, categoryPath: e.target.value }))
                      }
                    >
                      {categories.map((c) => (
                        <option key={c.path} value={c.path}>
                          {c.name} ({c.path})
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div>
                    <Label>Facet URL Slug</Label>
                    <Input
                      placeholder="platinum"
                      value={facetForm.facetSlug}
                      onChange={(e) => setFacetForm((f) => ({ ...f, facetSlug: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Display Name</Label>
                    <Input
                      placeholder="Platinum Engagement Rings"
                      value={facetForm.name}
                      onChange={(e) => setFacetForm((f) => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label>Page H1</Label>
                    <Input
                      placeholder="Platinum Diamond Engagement Rings"
                      value={facetForm.h1}
                      onChange={(e) => setFacetForm((f) => ({ ...f, h1: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <Label>Metals (CSV)</Label>
                    <Input
                      placeholder="950 Platinum"
                      value={facetForm.metalCsv}
                      onChange={(e) => setFacetForm((f) => ({ ...f, metalCsv: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Shapes (CSV)</Label>
                    <Input
                      placeholder="Emerald,Oval"
                      value={facetForm.shapeCsv}
                      onChange={(e) => setFacetForm((f) => ({ ...f, shapeCsv: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Labs (CSV)</Label>
                    <Input
                      placeholder="GIA"
                      value={facetForm.certCsv}
                      onChange={(e) => setFacetForm((f) => ({ ...f, certCsv: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Intro Editorial Copy</Label>
                  <Textarea
                    rows={2}
                    value={facetForm.introCopy}
                    onChange={(e) => setFacetForm((f) => ({ ...f, introCopy: e.target.value }))}
                  />
                </div>
                <Button type="submit" disabled={busy}>
                  <Plus className="mr-1.5 size-4" />
                  Save Landing Facet
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Curated Landing Facets ({landingFacets.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {landingFacets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No curated landing facets created yet.
                </p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {landingFacets.map((facet) => {
                    const url = `/collections/${facet.categoryPath}/${facet.facetSlug}`;
                    return (
                      <div
                        key={facet.id}
                        className="flex items-center justify-between gap-2 p-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{facet.name}</p>
                          <Link
                            href={url}
                            target="_blank"
                            className="font-mono text-xs text-accent-text hover:underline"
                          >
                            {url}
                          </Link>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => handleDeleteFacet(facet.id)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. STATIC PAGES SEO TAB */}
        <TabsContent value="static">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Static Pages Metadata Overrides</CardTitle>
              <CardDescription>
                Customize title, meta description, canonical, and robots for homepage &amp; policy
                routes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveStaticPage} className="max-w-2xl space-y-3">
                <div>
                  <Label htmlFor="seo-static-route">Static Route</Label>
                  <NativeSelect
                    id="seo-static-route"
                    value={selectedStaticSlug}
                    onChange={(e) => handleSelectStaticSlug(e.target.value)}
                  >
                    {staticPages.map((p) => (
                      <option key={p.slug} value={p.slug}>
                        {p.label} ({p.slug})
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div>
                  <Label>SEO Title ({staticForm.seoTitle.length}/60)</Label>
                  <Input
                    value={staticForm.seoTitle}
                    onChange={(e) => setStaticForm((f) => ({ ...f, seoTitle: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Meta Description ({staticForm.seoDescription.length}/158)</Label>
                  <Textarea
                    rows={3}
                    value={staticForm.seoDescription}
                    onChange={(e) =>
                      setStaticForm((f) => ({ ...f, seoDescription: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>SEO Keywords</Label>
                    <Input
                      value={staticForm.seoKeywords}
                      onChange={(e) =>
                        setStaticForm((f) => ({ ...f, seoKeywords: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Canonical Override</Label>
                    <Input
                      value={staticForm.canonicalOverride}
                      placeholder={selectedStaticSlug}
                      onChange={(e) =>
                        setStaticForm((f) => ({ ...f, canonicalOverride: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="seo-static-noindex"
                    checked={staticForm.noindex}
                    onCheckedChange={(checked) =>
                      setStaticForm((f) => ({ ...f, noindex: Boolean(checked) }))
                    }
                  />
                  <Label htmlFor="seo-static-noindex" className="cursor-pointer font-normal">
                    Exclude from indexing &amp; sitemap (noindex)
                  </Label>
                </div>
                <Button type="submit" disabled={busy}>
                  <Save className="mr-1.5 size-4" />
                  Save Static Page SEO
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
