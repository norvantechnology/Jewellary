"use client";

import * as React from "react";
import {
  CustomizeForm,
  type CustomizeFormProps,
} from "@/components/storefront/customize/CustomizeForm";
export type { UploadedCustomizationImageItem } from "@/components/storefront/customize/types";
export { CustomizeForm };

export interface CustomizationFormClientProps extends Omit<CustomizeFormProps, "variant"> {
  variant?: "page" | "drawer";
  compactHeader?: boolean;
}

export function CustomizationFormClient({
  variant,
  compactHeader = false,
  ...props
}: CustomizationFormClientProps) {
  return <CustomizeForm variant={variant ?? (compactHeader ? "drawer" : "page")} {...props} />;
}
