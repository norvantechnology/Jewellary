"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const RING_SIZE_ROWS = [
  { d: "14.9 mm", us: "4", uk: "H", eu: "47" },
  { d: "15.7 mm", us: "5", uk: "J 1/2", eu: "49" },
  { d: "16.5 mm", us: "6", uk: "L 1/2", eu: "52" },
  { d: "17.3 mm", us: "7", uk: "N 1/2", eu: "54" },
  { d: "18.1 mm", us: "8", uk: "P 1/2", eu: "57" },
  { d: "19.0 mm", us: "9", uk: "R 1/2", eu: "59" },
] as const;

interface RingSizeGuideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
}

export function RingSizeGuideSheet({ open, onOpenChange, onNavigate }: RingSizeGuideSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showDragHandle
        className="safe-area-pb max-h-[85dvh] overflow-y-auto px-4 pt-2 pb-6 sm:mx-auto sm:max-w-xl sm:px-6"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Ring Size Guide</SheetTitle>
          <SheetDescription>
            Measure an existing ring&apos;s internal diameter edge-to-edge or finger circumference
            at room temperature.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[320px] border-collapse text-left text-xs sm:text-sm">
            <thead className="border-b border-border bg-surface-2 text-text-2">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Diameter</th>
                <th className="px-3 py-2.5 font-semibold">US / CA</th>
                <th className="px-3 py-2.5 font-semibold">UK / AU</th>
                <th className="px-3 py-2.5 font-semibold">EU</th>
              </tr>
            </thead>
            <tbody className="tabular-nums-price divide-y divide-border">
              {RING_SIZE_ROWS.map((row) => (
                <tr key={row.us}>
                  <td className="px-3 py-2.5 font-medium text-foreground">{row.d}</td>
                  <td className="px-3 py-2.5 text-foreground">{row.us}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.uk}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{row.eu}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link
              href="/ring-size-guide"
              onClick={() => {
                onOpenChange(false);
                onNavigate?.();
              }}
            >
              Full measuring guide
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
