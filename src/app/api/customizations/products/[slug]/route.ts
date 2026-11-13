import { NextResponse } from "next/server";
import { getProductCustomizationSchema } from "@/modules/customization/customization.service";
import { jsonApiError } from "@/server/private-media-http";

export async function GET(_req: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const schema = await getProductCustomizationSchema(slug, { includeInactive: false });
    return NextResponse.json(schema, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    return jsonApiError(err);
  }
}
