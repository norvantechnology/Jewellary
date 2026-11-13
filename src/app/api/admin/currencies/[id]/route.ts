import { revalidateTag, updateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { updateCurrencySchema } from "@/modules/currencies/currency.schemas";
import { deleteAdminCurrency, updateAdminCurrency } from "@/modules/currencies/currency.service";
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

const patchBodySchema = updateCurrencySchema.omit({ id: true });

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("settings:manage");
    await enforceRateLimit("adminWrite", actor.user.id);
    const { id } = await context.params;

    const body = await request.json().catch(() => null);
    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid currency update payload.",
            fieldErrors: z.flattenError(parsed.error).fieldErrors,
          },
        },
        { status: 400 },
      );
    }

    const updated = await updateAdminCurrency(id, parsed.data, {
      id: actor.user.id,
      email: actor.user.email,
    });

    await writeAuditLog({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      actorRole: actor.user.role,
      action: "CURRENCY_UPDATE",
      entityType: "Currency",
      entityId: updated.id,
      after: updated,
    });

    revalidateCurrencies();
    return NextResponse.json({ currency: updated }, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("settings:manage");
    await enforceRateLimit("adminWrite", actor.user.id);
    const { id } = await context.params;

    const deleted = await deleteAdminCurrency(id);

    await writeAuditLog({
      actorId: actor.user.id,
      actorEmail: actor.user.email,
      actorRole: actor.user.role,
      action: "CURRENCY_DELETE",
      entityType: "Currency",
      entityId: deleted.id,
      before: deleted,
    });

    revalidateCurrencies();
    return NextResponse.json({ deleted }, { status: 200 });
  } catch (err) {
    return handleRouteError(err);
  }
}
