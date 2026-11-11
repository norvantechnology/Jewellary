"use client";

import * as React from "react";
import { visitorStore } from "@/modules/storefront/visitor-store";

interface VisitorStateHydratorProps {
  wishlistVariantIds: string[];
  bagCount: number;
}

export function VisitorStateHydrator({ wishlistVariantIds, bagCount }: VisitorStateHydratorProps) {
  const serialized = wishlistVariantIds.join(",");

  React.useEffect(() => {
    const ids = serialized ? serialized.split(",") : [];
    visitorStore.hydrate(ids, bagCount);
  }, [serialized, bagCount]);

  return null;
}
