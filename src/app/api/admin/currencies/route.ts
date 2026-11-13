import { revalidateTag, updateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createCurrencySchema } from "@/modules/currencies/currency.schemas";
import { createAdminCurrency, listAdminCurrencies } from "@/modules/currencies/currency.service";
import { writeAuditLog } from "@/server/audit";
import { CACHE_TAGS } from "@/server/cache-tags";
import { requirePermission } from "@/server/dal";
import { AppError } from "@/server/errors";
import { enforceRateLimit } from "@/server/rate-limit";

function revalidateCurrencies() {
  updateTag(CACHE_TAGS.currencies);
  revalidateTag(CACHE_TAGS.currencies, "max");
  revalidateTag(CACHE_TAGS.settings, "max");
}

function handleRouteError(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.statusCode },
    );
  }
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Unexpected currency service error." } },
    { status: 500 },
  );
}

export async function GET() {
  try {
    await requirePermission("settings:manage");
    const data = await listAdminCurrencies();
    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("settings:manage");
    await enforceRateLimit("adminWrite", actor.user.id);

    const body = await request.json().catch(() => null);
    const parsed = createCurrencySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid currency payload.",
            fieldErrors: z.flattenError(parsed.error).fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const created = await createAdminCurrency(parsed.data, {
      id: actor.user.id,
      email: actor.user.email,
    });

    await writeAuditLog({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      actorRole: actor.user.role,
      action: "CURRENCY_CREATE",
      entityType: "Currency",
      entityId: created.id,
      after: created,
    });

    revalidateCurrencies();
    return NextResponse.json({ currency: created }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
