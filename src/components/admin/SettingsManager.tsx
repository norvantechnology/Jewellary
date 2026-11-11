"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Edit2, Plus, Save, Trash2, Truck, X } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
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
import { formatMoney } from "@/lib/money";
import {
  deleteShippingZoneAction,
  updateStoreSettingsAction,
  upsertShippingZoneAction,
} from "@/modules/settings/settings.actions";
import type { PublicStoreSettings, ShippingZoneDTO } from "@/modules/settings/settings.service";

interface ZoneFormState {
  id?: string;
  name: string;
  countriesCsv: string;
  flatRate: string;
  freeThreshold: string;
  estimatedDaysMin: string;
  estimatedDaysMax: string;
  isInsured: boolean;
  isActive: boolean;
  sortOrder: string;
}

const emptyZone = (): ZoneFormState => ({
  name: "",
  countriesCsv: "US",
  flatRate: "25.00",
  freeThreshold: "1000.00",
  estimatedDaysMin: "2",
  estimatedDaysMax: "4",
  isInsured: true,
  isActive: true,
  sortOrder: "0",
});

export function SettingsManager({
  settings,
  zones,
}: {
  settings: PublicStoreSettings;
  zones: ShippingZoneDTO[];
}) {
  const router = useRouter();
  const [savingSettings, setSavingSettings] = React.useState(false);

  const [storeName, setStoreName] = React.useState(settings.storeName);
  const [tagline, setTagline] = React.useState(settings.tagline ?? "");
  const [contactEmail, setContactEmail] = React.useState(settings.contactEmail);
  const [contactPhone, setContactPhone] = React.useState(settings.contactPhone ?? "");
  const [supportHours, setSupportHours] = React.useState(settings.supportHours ?? "");
  const [logoUrl, setLogoUrl] = React.useState(settings.logoUrl ?? "");
  const [announcementBarEnabled, setAnnouncementBarEnabled] = React.useState(
    settings.announcementBarEnabled,
  );
  const [announcementBarText, setAnnouncementBarText] = React.useState(
    settings.announcementBarText ?? "",
  );
  const [announcementBarHref, setAnnouncementBarHref] = React.useState(
    settings.announcementBarHref ?? "",
  );

  const [currency, setCurrency] = React.useState(settings.currency);
  const [defaultCountry, setDefaultCountry] = React.useState(settings.defaultCountry);
  const [countriesCsv, setCountriesCsv] = React.useState(settings.supportedCountries.join(", "));
  const [taxRatePercent, setTaxRatePercent] = React.useState(() => {
    const num = Number(settings.taxRate);
    return Number.isFinite(num) ? (num * 100).toFixed(2).replace(/\.00$/, "") : "8";
  });
  const [taxLabel, setTaxLabel] = React.useState(settings.taxLabel);
  const [taxInclusive, setTaxInclusive] = React.useState(settings.taxInclusive);
  const [freeShippingThreshold, setFreeShippingThreshold] = React.useState(
    settings.freeShippingThreshold ?? "",
  );
  const [signatureThreshold, setSignatureThreshold] = React.useState(settings.signatureThreshold);
  const [returnWindowDays, setReturnWindowDays] = React.useState(String(settings.returnWindowDays));

  const [allowAiCrawlers, setAllowAiCrawlers] = React.useState(settings.allowAiCrawlers);
  const [seoDefaultTitlePattern, setSeoDefaultTitlePattern] = React.useState(
    settings.seoDefaultTitlePattern ?? "",
  );
  const [seoDefaultDescription, setSeoDefaultDescription] = React.useState(
    settings.seoDefaultDescription ?? "",
  );
  const [defaultOgImageUrl, setDefaultOgImageUrl] = React.useState(
    settings.defaultOgImageUrl ?? "",
  );

  const [socialLinks, setSocialLinks] = React.useState(settings.socialLinks);
  const [physicalStore, setPhysicalStore] = React.useState({
    name: settings.physicalStore?.name ?? "",
    streetAddress: settings.physicalStore?.streetAddress ?? "",
    city: settings.physicalStore?.city ?? "",
    state: settings.physicalStore?.state ?? "",
    postalCode: settings.physicalStore?.postalCode ?? "",
    country: settings.physicalStore?.country ?? "",
    hours: settings.physicalStore?.hours ?? "",
  });

  // Shipping zone modal state
  const [zoneDialogOpen, setZoneDialogOpen] = React.useState(false);
  const [zoneForm, setZoneForm] = React.useState<ZoneFormState>(emptyZone);
  const [savingZone, setSavingZone] = React.useState(false);
  const [deleteZoneTarget, setDeleteZoneTarget] = React.useState<ShippingZoneDTO | null>(null);
  const [deletingZone, setDeletingZone] = React.useState(false);

  async function saveStoreSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);

    const parsedCountries = countriesCsv
      .split(/[,\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length === 2);

    const res = await updateStoreSettingsAction({
      storeName,
      tagline: tagline || null,
      contactEmail,
      contactPhone: contactPhone || null,
      supportHours: supportHours || null,
      currency,
      defaultCountry,
      supportedCountries: parsedCountries.length > 0 ? parsedCountries : ["US"],
      taxRatePercent: Number(taxRatePercent || "0"),
      taxLabel,
      taxInclusive,
      freeShippingThreshold: freeShippingThreshold || "",
      signatureThreshold,
      returnWindowDays: Number(returnWindowDays || "30"),
      announcementBarEnabled,
      announcementBarText: announcementBarText || null,
      announcementBarHref: announcementBarHref || null,
      logoUrl: logoUrl || null,
      allowAiCrawlers,
      seoDefaultTitlePattern: seoDefaultTitlePattern || null,
      seoDefaultDescription: seoDefaultDescription || null,
      defaultOgImageUrl: defaultOgImageUrl || null,
      socialLinks: socialLinks.filter((s) => s.label.trim() && s.href.trim()),
      physicalStore:
        physicalStore.streetAddress.trim() || physicalStore.name.trim() ? physicalStore : null,
    });

    setSavingSettings(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    toast.success("Store settings updated across storefront.");
    router.refresh();
  }

  function openNewZone() {
    setZoneForm(emptyZone());
    setZoneDialogOpen(true);
  }

  function openEditZone(z: ShippingZoneDTO) {
    setZoneForm({
      id: z.id,
      name: z.name,
      countriesCsv: z.countries.join(", "),
      flatRate: z.flatRate,
      freeThreshold: z.freeThreshold ?? "",
      estimatedDaysMin: String(z.estimatedDaysMin),
      estimatedDaysMax: String(z.estimatedDaysMax),
      isInsured: z.isInsured,
      isActive: z.isActive,
      sortOrder: String(z.sortOrder),
    });
    setZoneDialogOpen(true);
  }

  async function saveZone(e: React.FormEvent) {
    e.preventDefault();
    setSavingZone(true);

    const countries = zoneForm.countriesCsv
      .split(/[,\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length === 2);

    const res = await upsertShippingZoneAction({
      id: zoneForm.id,
      name: zoneForm.name,
      countries,
      flatRate: zoneForm.flatRate,
      freeThreshold: zoneForm.freeThreshold || "",
      estimatedDaysMin: Number(zoneForm.estimatedDaysMin || "1"),
      estimatedDaysMax: Number(zoneForm.estimatedDaysMax || "3"),
      isInsured: zoneForm.isInsured,
      isActive: zoneForm.isActive,
      sortOrder: Number(zoneForm.sortOrder || "0"),
    });

    setSavingZone(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    toast.success(zoneForm.id ? "Shipping zone updated." : "Shipping zone created.");
    setZoneDialogOpen(false);
    router.refresh();
  }

  async function handleDeleteZone() {
    if (!deleteZoneTarget) return;
    setDeletingZone(true);
    const res = await deleteShippingZoneAction({ id: deleteZoneTarget.id });
    setDeletingZone(false);

    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }

    toast.success(`Deleted shipping zone "${deleteZoneTarget.name}".`);
    setDeleteZoneTarget(null);
    router.refresh();
  }

  const zoneColumns: ResponsiveColumn<ShippingZoneDTO>[] = [
    {
      key: "name",
      header: "Zone",
      cell: (z) => (
        <div>
          <p className="font-medium text-foreground">{z.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{z.countries.join(", ")}</p>
        </div>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      cell: (z) => (
        <div className="text-sm tabular-nums-price">
          <p>{formatMoney(z.flatRate, settings.currency)}</p>
          {z.freeThreshold && (
            <p className="text-xs text-muted-foreground">
              Free over {formatMoney(z.freeThreshold, settings.currency)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "eta",
      header: "Delivery ETA",
      cell: (z) => `${z.estimatedDaysMin}–${z.estimatedDaysMax} business days`,
    },
    {
      key: "status",
      header: "Status",
      cell: (z) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={z.isActive ? "success" : "default"}>
            {z.isActive ? "Active" : "Disabled"}
          </Badge>
          {z.isInsured && <Badge variant="outline">Insured</Badge>}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (z) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openEditZone(z)}>
            <Edit2 className="size-3.5" aria-hidden="true" />
            <span>Edit</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDeleteZoneTarget(z)}
            aria-label={`Delete shipping zone ${z.name}`}
          >
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <p className="text-editorial-label text-accent-text">Administrator Configuration</p>
        <h1 className="mt-1 font-display text-3xl font-medium text-foreground">
          Store Settings &amp; Shipping Zones
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage brand identity, tax computation rules, courier thresholds, AI crawler rules, and
          insured courier zones.
        </p>
      </div>

      <Tabs defaultValue="identity">
        <TabsList>
          <TabsTrigger value="identity">Brand &amp; Salon</TabsTrigger>
          <TabsTrigger value="commerce">Commerce &amp; Tax</TabsTrigger>
          <TabsTrigger value="seo">SEO &amp; AI Bots</TabsTrigger>
          <TabsTrigger value="shipping">Shipping Zones ({zones.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="identity">
          <form onSubmit={saveStoreSettings} className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="font-display text-xl font-medium">Maison Identity &amp; Banner</h2>
                <CardDescription>
                  Updates header wordmark, concierge contact channels, and announcement bar copy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="set-name" label="Store Name" required>
                    {(aria) => (
                      <Input
                        {...aria}
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        required
                      />
                    )}
                  </FormField>
                  <FormField id="set-tagline" label="Tagline">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                      />
                    )}
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField id="set-email" label="Concierge Email" required>
                    {(aria) => (
                      <Input
                        {...aria}
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        required
                      />
                    )}
                  </FormField>
                  <FormField id="set-phone" label="Concierge Phone">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField id="set-hours" label="Support Hours">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={supportHours}
                        onChange={(e) => setSupportHours(e.target.value)}
                      />
                    )}
                  </FormField>
                </div>

                <ImageUploadField
                  id="set-logo"
                  folder="store"
                  label="Custom Wordmark / Emblem Image (Optional)"
                  currentUrl={logoUrl}
                  onUrlChange={setLogoUrl}
                  onUploaded={(asset) => setLogoUrl(asset.url)}
                />

                <div className="space-y-3 rounded-sm border border-border p-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="set-ann-on" className="cursor-pointer">
                      Show Top Announcement Bar
                    </Label>
                    <Switch
                      id="set-ann-on"
                      checked={announcementBarEnabled}
                      onCheckedChange={setAnnouncementBarEnabled}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField id="set-ann-text" label="Announcement Copy">
                      {(aria) => (
                        <Input
                          {...aria}
                          value={announcementBarText}
                          onChange={(e) => setAnnouncementBarText(e.target.value)}
                        />
                      )}
                    </FormField>
                    <FormField id="set-ann-href" label="Link Target">
                      {(aria) => (
                        <Input
                          {...aria}
                          value={announcementBarHref}
                          onChange={(e) => setAnnouncementBarHref(e.target.value)}
                        />
                      )}
                    </FormField>
                  </div>
                </div>

                <div className="space-y-3 rounded-sm border border-border p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Social Channels</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setSocialLinks((prev) => [...prev, { label: "", href: "https://" }])
                      }
                    >
                      Add Channel
                    </Button>
                  </div>
                  {socialLinks.map((link, idx) => (
                    <div key={idx} className="grid items-end gap-2 sm:grid-cols-11">
                      <div className="sm:col-span-4">
                        <Label htmlFor={`soc-l-${idx}`} className="text-xs">
                          Label
                        </Label>
                        <Input
                          id={`soc-l-${idx}`}
                          value={link.label}
                          onChange={(e) =>
                            setSocialLinks((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx]!, label: e.target.value };
                              return next;
                            })
                          }
                        />
                      </div>
                      <div className="sm:col-span-6">
                        <Label htmlFor={`soc-h-${idx}`} className="text-xs">
                          URL
                        </Label>
                        <Input
                          id={`soc-h-${idx}`}
                          value={link.href}
                          onChange={(e) =>
                            setSocialLinks((prev) => {
                              const next = [...prev];
                              next[idx] = { ...next[idx]!, href: e.target.value };
                              return next;
                            })
                          }
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove social link ${idx + 1}`}
                          onClick={() => setSocialLinks((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <X className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 rounded-sm border border-border p-4">
                  <p className="text-sm font-medium">Physical Boutique / Salon (Optional Schema)</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      aria-label="Salon Name"
                      placeholder="Salon Name"
                      value={physicalStore.name}
                      onChange={(e) => setPhysicalStore((p) => ({ ...p, name: e.target.value }))}
                    />
                    <Input
                      aria-label="Opening Hours"
                      placeholder="Mon–Sat 10:00–18:00"
                      value={physicalStore.hours}
                      onChange={(e) => setPhysicalStore((p) => ({ ...p, hours: e.target.value }))}
                    />
                    <Input
                      aria-label="Street Address"
                      placeholder="Street Address"
                      value={physicalStore.streetAddress}
                      onChange={(e) =>
                        setPhysicalStore((p) => ({ ...p, streetAddress: e.target.value }))
                      }
                    />
                    <Input
                      aria-label="City"
                      placeholder="City"
                      value={physicalStore.city}
                      onChange={(e) => setPhysicalStore((p) => ({ ...p, city: e.target.value }))}
                    />
                    <Input
                      aria-label="State"
                      placeholder="State / Region"
                      value={physicalStore.state}
                      onChange={(e) => setPhysicalStore((p) => ({ ...p, state: e.target.value }))}
                    />
                    <Input
                      aria-label="Postal Code & Country"
                      placeholder="Postal Code"
                      value={physicalStore.postalCode}
                      onChange={(e) =>
                        setPhysicalStore((p) => ({ ...p, postalCode: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" loading={savingSettings} className="gap-1.5">
                <Save className="size-4" aria-hidden="true" />
                <span>Save Settings</span>
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="commerce">
          <form onSubmit={saveStoreSettings} className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="font-display text-xl font-medium">
                  Currency, Tax &amp; Return Policy Thresholds
                </h2>
                <CardDescription>
                  Used by checkout re-pricing, Product JSON-LD MerchantReturnPolicy, and insured
                  signature rules.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField id="com-curr" label="ISO Currency Code" required>
                    {(aria) => (
                      <Input
                        {...aria}
                        maxLength={3}
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                        required
                      />
                    )}
                  </FormField>
                  <FormField id="com-country" label="Default Country (ISO-2)" required>
                    {(aria) => (
                      <Input
                        {...aria}
                        maxLength={2}
                        value={defaultCountry}
                        onChange={(e) => setDefaultCountry(e.target.value.toUpperCase())}
                        required
                      />
                    )}
                  </FormField>
                  <FormField id="com-countries" label="Supported Countries (CSV)" required>
                    {(aria) => (
                      <Input
                        {...aria}
                        value={countriesCsv}
                        onChange={(e) => setCountriesCsv(e.target.value)}
                        required
                      />
                    )}
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField id="com-taxpct" label="Tax Rate (%)" required>
                    {(aria) => (
                      <Input
                        {...aria}
                        type="number"
                        step="0.01"
                        min={0}
                        max={50}
                        value={taxRatePercent}
                        onChange={(e) => setTaxRatePercent(e.target.value)}
                        required
                      />
                    )}
                  </FormField>
                  <FormField id="com-taxlabel" label="Tax Line Label" required>
                    {(aria) => (
                      <Input
                        {...aria}
                        value={taxLabel}
                        onChange={(e) => setTaxLabel(e.target.value)}
                        required
                      />
                    )}
                  </FormField>
                  <div className="flex items-center justify-between rounded-sm border border-border px-3.5 py-2.5">
                    <Label htmlFor="com-taxinc" className="cursor-pointer">
                      Prices Include Tax
                    </Label>
                    <Switch
                      id="com-taxinc"
                      checked={taxInclusive}
                      onCheckedChange={setTaxInclusive}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField id="com-freeship" label="Free Insured Shipping Threshold">
                    {(aria) => (
                      <Input
                        {...aria}
                        value={freeShippingThreshold}
                        onChange={(e) => setFreeShippingThreshold(e.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField id="com-sig" label="Signature Required Threshold" required>
                    {(aria) => (
                      <Input
                        {...aria}
                        value={signatureThreshold}
                        onChange={(e) => setSignatureThreshold(e.target.value)}
                        required
                      />
                    )}
                  </FormField>
                  <FormField id="com-ret" label="Return Window (Days)" required>
                    {(aria) => (
                      <Input
                        {...aria}
                        type="number"
                        min={0}
                        max={365}
                        value={returnWindowDays}
                        onChange={(e) => setReturnWindowDays(e.target.value)}
                        required
                      />
                    )}
                  </FormField>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" loading={savingSettings} className="gap-1.5">
                <Save className="size-4" aria-hidden="true" />
                <span>Save Commerce Rules</span>
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="seo">
          <form onSubmit={saveStoreSettings} className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="font-display text-xl font-medium">
                  Default SEO &amp; AI Crawler Policy
                </h2>
                <CardDescription>
                  Controls global metadata templates and AI crawler directives inside robots.txt.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-sm border border-border px-4 py-3">
                  <div>
                    <Label htmlFor="seo-ai" className="cursor-pointer">
                      Allow AI Search &amp; Discovery Crawlers
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Permits OAI-SearchBot, ChatGPT-User, ClaudeBot, and PerplexityBot on public
                      storefront routes.
                    </p>
                  </div>
                  <Switch
                    id="seo-ai"
                    checked={allowAiCrawlers}
                    onCheckedChange={setAllowAiCrawlers}
                  />
                </div>

                <FormField id="seo-pat" label="Default Title Pattern">
                  {(aria) => (
                    <Input
                      {...aria}
                      value={seoDefaultTitlePattern}
                      onChange={(e) => setSeoDefaultTitlePattern(e.target.value)}
                      placeholder="%s | Maison Aurelia"
                    />
                  )}
                </FormField>

                <FormField id="seo-defdesc" label="Default Store Meta Description">
                  {(aria) => (
                    <Textarea
                      {...aria}
                      rows={3}
                      value={seoDefaultDescription}
                      onChange={(e) => setSeoDefaultDescription(e.target.value)}
                    />
                  )}
                </FormField>

                <ImageUploadField
                  id="seo-ogimg"
                  folder="store"
                  label="Fallback Open Graph Image"
                  currentUrl={defaultOgImageUrl}
                  onUrlChange={setDefaultOgImageUrl}
                  onUploaded={(asset) => setDefaultOgImageUrl(asset.url)}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" loading={savingSettings} className="gap-1.5">
                <Save className="size-4" aria-hidden="true" />
                <span>Save SEO Settings</span>
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="shipping" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-medium">Courier Shipping Zones</h2>
              <p className="text-sm text-muted-foreground">
                Authoritative shipping flat rates, insured delivery windows, and complimentary
                thresholds.
              </p>
            </div>
            <Button type="button" onClick={openNewZone} className="gap-1.5">
              <Plus className="size-4" aria-hidden="true" />
              <span>Add Shipping Zone</span>
            </Button>
          </div>

          <ResponsiveDataTable
            data={zones}
            columns={zoneColumns}
            keyExtractor={(z) => z.id}
            mobileTitle={(z) => z.name}
            emptyState={
              <EmptyState
                icon={Truck}
                title="No Shipping Zones"
                description="Add regional courier zones to compute checkout shipping totals."
                actionLabel="Add Zone"
                onAction={openNewZone}
              />
            }
          />
        </TabsContent>
      </Tabs>

      <Dialog open={zoneDialogOpen} onOpenChange={setZoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{zoneForm.id ? "Edit Shipping Zone" : "Add Shipping Zone"}</DialogTitle>
            <DialogDescription>
              Use 2-letter uppercase ISO country codes separated by commas (e.g. US, CA, GB).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveZone} className="space-y-4">
            <FormField id="zn-name" label="Zone Name" required>
              {(aria) => (
                <Input
                  {...aria}
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm((z) => ({ ...z, name: e.target.value }))}
                  required
                />
              )}
            </FormField>

            <FormField id="zn-countries" label="Countries (ISO-2 CSV)" required>
              {(aria) => (
                <Input
                  {...aria}
                  value={zoneForm.countriesCsv}
                  onChange={(e) => setZoneForm((z) => ({ ...z, countriesCsv: e.target.value }))}
                  required
                />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="zn-flat" label="Flat Rate" required>
                {(aria) => (
                  <Input
                    {...aria}
                    value={zoneForm.flatRate}
                    onChange={(e) => setZoneForm((z) => ({ ...z, flatRate: e.target.value }))}
                    required
                  />
                )}
              </FormField>
              <FormField id="zn-free" label="Free Threshold (Optional)">
                {(aria) => (
                  <Input
                    {...aria}
                    value={zoneForm.freeThreshold}
                    onChange={(e) => setZoneForm((z) => ({ ...z, freeThreshold: e.target.value }))}
                  />
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="zn-min" label="Min Days" required>
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    min={1}
                    value={zoneForm.estimatedDaysMin}
                    onChange={(e) =>
                      setZoneForm((z) => ({ ...z, estimatedDaysMin: e.target.value }))
                    }
                    required
                  />
                )}
              </FormField>
              <FormField id="zn-max" label="Max Days" required>
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    min={1}
                    value={zoneForm.estimatedDaysMax}
                    onChange={(e) =>
                      setZoneForm((z) => ({ ...z, estimatedDaysMax: e.target.value }))
                    }
                    required
                  />
                )}
              </FormField>
              <FormField id="zn-sort" label="Priority Order">
                {(aria) => (
                  <Input
                    {...aria}
                    type="number"
                    min={0}
                    value={zoneForm.sortOrder}
                    onChange={(e) => setZoneForm((z) => ({ ...z, sortOrder: e.target.value }))}
                  />
                )}
              </FormField>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-sm border border-border px-3 py-2">
                <Label htmlFor="zn-insured">Insured Courier</Label>
                <Switch
                  id="zn-insured"
                  checked={zoneForm.isInsured}
                  onCheckedChange={(v) => setZoneForm((z) => ({ ...z, isInsured: v }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-sm border border-border px-3 py-2">
                <Label htmlFor="zn-active">Zone Active</Label>
                <Switch
                  id="zn-active"
                  checked={zoneForm.isActive}
                  onCheckedChange={(v) => setZoneForm((z) => ({ ...z, isActive: v }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setZoneDialogOpen(false)}
                disabled={savingZone}
              >
                Cancel
              </Button>
              <Button type="submit" loading={savingZone}>
                Save Zone
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteZoneTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteZoneTarget(null);
        }}
        title="Delete Shipping Zone"
        description={deleteZoneTarget ? `Remove "${deleteZoneTarget.name}" shipping zone?` : ""}
        confirmLabel="Delete Zone"
        destructive
        loading={deletingZone}
        onConfirm={handleDeleteZone}
      />
    </div>
  );
}
