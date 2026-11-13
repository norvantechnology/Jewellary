"use client";

import * as React from "react";
import { Gem, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { FormField } from "@/components/shared/FormField";
import { Pagination } from "@/components/shared/Pagination";
import { Price } from "@/components/shared/Price";
import { Container, Grid, Section, Stack } from "@/components/shared/primitives";
import { QuantityStepper } from "@/components/shared/QuantityStepper";
import {
  ResponsiveDataTable,
  type ResponsiveColumn,
} from "@/components/shared/ResponsiveDataTable";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface SampleDiamondRow {
  id: string;
  sku: string;
  title: string;
  carat: string;
  price: string;
  status: string;
}

const SAMPLE_ROWS: SampleDiamondRow[] = [
  {
    id: "1",
    sku: "AUR-SOL-18Y-6",
    title: "Celeste Solitaire 18K Yellow Gold",
    carat: "1.50 ct",
    price: "6850",
    status: "In Stock",
  },
  {
    id: "2",
    sku: "AUR-HAL-PT-5",
    title: "Lumiere Oval Halo Platinum",
    carat: "2.05 ct",
    price: "11400",
    status: "Only 1 Left",
  },
];

const COLUMNS: ResponsiveColumn<SampleDiamondRow>[] = [
  { key: "sku", header: "SKU", cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
  { key: "title", header: "Piece", cell: (r) => r.title, hideOnMobileCard: true },
  { key: "carat", header: "Carat", cell: (r) => r.carat },
  { key: "price", header: "Price", cell: (r) => <Price amount={r.price} /> },
  {
    key: "status",
    header: "Availability",
    cell: (r) => (
      <Badge variant={r.status === "In Stock" ? "success" : "warning"}>{r.status}</Badge>
    ),
  },
];

export function DevUiShowcase() {
  const [qty, setQty] = React.useState(1);
  const [priceRange, setPriceRange] = React.useState([1500, 12000]);
  const [metal, setMetal] = React.useState("18k-yellow");
  const [checked, setChecked] = React.useState(true);
  const [switched, setSwitched] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  return (
    <main id="main-content" className="min-h-dvh bg-background">
      <Section spacing="md">
        <Container>
          <Stack gap="lg">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
              <div>
                <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "UI Gallery" }]} />
                <p className="text-editorial-label text-accent-text">Design System Showcase</p>
                <h1 className="mt-1 text-3xl leading-[1.2] font-semibold tracking-[-0.02em] text-foreground sm:text-4xl">
                  Atelier Component Library
                </h1>
              </div>
              <ThemeSwitcher />
            </div>

            <div className="gold-hairline w-full" aria-hidden="true" />

            <section aria-labelledby="tokens-heading">
              <h2
                id="tokens-heading"
                className="text-2xl leading-[1.2] font-semibold tracking-[-0.015em] text-foreground"
              >
                Buttons, Badges &amp; Typography
              </h2>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Text Link</Button>
                <Button variant="destructive">Destructive</Button>
                <Button loading>Processing</Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="default">New Arrival</Badge>
                <Badge variant="outline">GIA Certified</Badge>
                <Badge variant="primary">Bestseller</Badge>
                <Badge variant="success">In Stock</Badge>
                <Badge variant="warning">Only 1 Left</Badge>
                <Badge variant="destructive">Sold Out</Badge>
              </div>
              <div className="mt-4 flex flex-wrap items-baseline gap-6">
                <Price amount="8450" compareAtAmount="9200" size="lg" />
                <Price amount="2400" prefix="From" />
                <Price isPriceOnRequest />
              </div>
            </section>

            <Grid cols={2}>
              <Card>
                <CardHeader>
                  <CardTitle>Form Controls</CardTitle>
                  <CardDescription>
                    Accessible controls using neutral stone surfaces and warm gold tokens.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Stack gap="md">
                    <FormField
                      id="demo-email"
                      label="Client Email"
                      required
                      hint="Used for order dossier"
                    >
                      {(aria) => <Input type="email" placeholder="claire@example.com" {...aria} />}
                    </FormField>

                    <FormField
                      id="demo-notes"
                      label="Bespoke Engraving Notes"
                      error="Maximum 25 characters"
                    >
                      {(aria) => <Textarea placeholder="Initials or date..." {...aria} />}
                    </FormField>

                    <div className="grid gap-2">
                      <Label htmlFor="demo-select">Precious Metal</Label>
                      <Select defaultValue="18k-yellow">
                        <SelectTrigger id="demo-select">
                          <SelectValue placeholder="Choose metal" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="18k-yellow">18K Yellow Gold</SelectItem>
                          <SelectItem value="18k-rose">18K Rose Gold</SelectItem>
                          <SelectItem value="platinum">950 Platinum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="demo-combobox">Diamond Shape Combobox</Label>
                      <Combobox
                        id="demo-combobox"
                        value={metal}
                        onValueChange={setMetal}
                        options={[
                          { value: "18k-yellow", label: "Round Brilliant" },
                          { value: "oval", label: "Oval Cut" },
                          { value: "emerald", label: "Emerald Step Cut" },
                        ]}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="demo-check"
                          checked={checked}
                          onCheckedChange={(v) => setChecked(v === true)}
                        />
                        <Label htmlFor="demo-check">Insured signature delivery</Label>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch id="demo-switch" checked={switched} onCheckedChange={setSwitched} />
                        <Label htmlFor="demo-switch">Gift presentation</Label>
                      </div>
                    </div>

                    <RadioGroup defaultValue="natural" aria-label="Diamond origin">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="natural" id="origin-nat" />
                        <Label htmlFor="origin-nat">Natural Mined Diamond</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="lab" id="origin-lab" />
                        <Label htmlFor="origin-lab">Lab-Grown Diamond</Label>
                      </div>
                    </RadioGroup>

                    <div>
                      <p className="mb-2 text-xs text-muted-foreground">
                        Price range: ${priceRange[0]} – ${priceRange[1]}
                      </p>
                      <Slider
                        value={priceRange}
                        min={500}
                        max={25000}
                        step={250}
                        onValueChange={setPriceRange}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <QuantityStepper value={qty} min={1} max={5} onChange={setQty} />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => toast.success("Added to your bag")}
                      >
                        Trigger Toast
                      </Button>
                    </div>
                  </Stack>
                </CardContent>
              </Card>

              <Stack gap="md">
                <Card>
                  <CardHeader>
                    <CardTitle>Overlays, Tabs &amp; Accordions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="specs">
                      <TabsList>
                        <TabsTrigger value="specs">Specifications</TabsTrigger>
                        <TabsTrigger value="cert">Certification</TabsTrigger>
                      </TabsList>
                      <TabsContent value="specs">
                        <p className="text-sm text-muted-foreground">
                          Hand-forged cathedral basket in recycled 18K yellow gold.
                        </p>
                      </TabsContent>
                      <TabsContent value="cert">
                        <p className="text-sm text-muted-foreground">
                          Accompanied by a numbered GIA Diamond Grading Report.
                        </p>
                      </TabsContent>
                    </Tabs>

                    <Accordion type="single" collapsible className="mt-4">
                      <AccordionItem value="care">
                        <AccordionTrigger>Care &amp; Cleaning</AccordionTrigger>
                        <AccordionContent>
                          Soak in warm water with mild soap and gently brush with a soft bristle.
                        </AccordionContent>
                      </AccordionItem>
                      <AccordionItem value="shipping">
                        <AccordionTrigger>Insured Delivery</AccordionTrigger>
                        <AccordionContent>
                          Complimentary insured courier delivery with adult signature required.
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline">Open Dialog</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Private Viewing Appointment</DialogTitle>
                            <DialogDescription>
                              Reserve a consultation with our senior gemologist.
                            </DialogDescription>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground">
                            Available Monday through Saturday in person or via secure video link.
                          </p>
                        </DialogContent>
                      </Dialog>

                      <Sheet>
                        <SheetTrigger asChild>
                          <Button variant="outline">Open Drawer</Button>
                        </SheetTrigger>
                        <SheetContent side="right">
                          <SheetHeader>
                            <SheetTitle>Shopping Bag Preview</SheetTitle>
                            <SheetDescription>
                              Complimentary insured shipping unlocked.
                            </SheetDescription>
                          </SheetHeader>
                        </SheetContent>
                      </Sheet>

                      <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                        Confirm Action
                      </Button>
                      <ConfirmDialog
                        open={confirmOpen}
                        onOpenChange={setConfirmOpen}
                        title="Archive Jewellery Piece?"
                        description="Existing order history remains preserved."
                        destructive
                        onConfirm={() => {
                          setConfirmOpen(false);
                          toast.success("Piece archived");
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Loading &amp; Empty States</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Skeleton className="size-14 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Stack>
            </Grid>

            <ResponsiveDataTable
              data={SAMPLE_ROWS}
              columns={COLUMNS}
              keyExtractor={(r) => r.id}
              mobileTitle={(r) => r.title}
            />

            <Pagination currentPage={2} totalPages={5} buildHref={(p) => `/dev/ui?page=${p}`} />

            <EmptyState
              icon={Gem}
              title="No Pieces Match Your Filter"
              description="Adjust your metal or carat preferences to reveal more creations from the maison."
              actionLabel="Reset Filters"
              actionHref="/collections"
            />

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="size-5 stroke-[1.5] text-accent-text" aria-hidden="true" />
              <span>All semantic tokens verified in light and dark modes.</span>
            </div>
          </Stack>
        </Container>
      </Section>
    </main>
  );
}
