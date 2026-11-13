import { NextResponse } from "next/server";
import { adminListCustomizationsSchema } from "@/modules/customization/customization.schemas";
import { listAdminCustomizationRequests } from "@/modules/customization/customization.service";
import { requirePermission } from "@/server/dal";
import { ValidationError } from "@/server/errors";
import { jsonApiError } from "@/server/private-media-http";

export async function GET(req: Request) {
  try {
    await requirePermission("customization:manage");
    const url = new URL(req.url);
    const parsed = adminListCustomizationsSchema.safeParse(
      Object.fromEntries(url.searchParams.entries()),
    );
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid filter parameters.");
    }
    const result = await listAdminCustomizationRequests(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    return jsonApiError(err);
  }
}
