import { NextResponse } from "next/server";
import { adminCannedReplySchema } from "@/modules/chat/chat.schemas";
import {
  deleteCannedReply,
  listCannedReplies,
  upsertCannedReply,
} from "@/modules/chat/chat.service";
import { requirePermission } from "@/server/dal";
import { ValidationError } from "@/server/errors";
import { jsonApiError } from "@/server/private-media-http";

export async function GET(req: Request) {
  try {
    await requirePermission("chat:manage");
    const url = new URL(req.url);
    const includeInactive = url.searchParams.get("all") === "1";
    const items = await listCannedReplies(includeInactive);
    return NextResponse.json({ ok: true, data: { items } });
  } catch (err) {
    return jsonApiError(err);
  }
}

export async function POST(req: Request) {
  try {
    await requirePermission("chat:manage");
    const raw = await req.json().catch(() => ({}));
    const parsed = adminCannedReplySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid canned reply.");
    }
    const item = await upsertCannedReply(parsed.data);
    return NextResponse.json({ ok: true, data: { item } });
  } catch (err) {
    return jsonApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await requirePermission("chat:manage");
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      throw new ValidationError("Missing canned reply ID.");
    }
    await deleteCannedReply(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonApiError(err);
  }
}
