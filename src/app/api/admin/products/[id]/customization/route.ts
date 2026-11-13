import { NextResponse } from "next/server";
import { getAdminProductCustomizationEditorData } from "@/modules/customization/customization.service";
import { requirePermission } from "@/server/dal";
import { jsonApiError } from "@/server/private-media-http";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("customization:manage");
    const { id } = await context.params;
    const data = await getAdminProductCustomizationEditorData(id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return jsonApiError(err);
  }
}
