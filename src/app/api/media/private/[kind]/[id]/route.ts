import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { assertCustomerOrGuestOwnership, resolveActorIdentity } from "@/server/customer-identity";
import { db } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import {
  getBaseKeyFromPrivateKey,
  hashOwnerKey,
  readPrivateMediaBuffer,
  verifySignedPrivateMediaParams,
  type PrivateMediaKind,
} from "@/server/private-media";
import { jsonApiError } from "@/server/private-media-http";

const VALID_KINDS = new Set<PrivateMediaKind>(["draft", "customization", "chat"]);

export async function GET(
  req: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  try {
    const { kind: rawKind, id } = await context.params;
    if (!VALID_KINDS.has(rawKind as PrivateMediaKind)) {
      throw new NotFoundError("Media resource not found.");
    }
    const kind = rawKind as PrivateMediaKind;

    const url = new URL(req.url);
    const storageKey = url.searchParams.get("key") ?? "";
    const exp = url.searchParams.get("exp");
    const sig = url.searchParams.get("sig");
    const thumb = url.searchParams.get("thumb") === "1";

    const signatureOk = verifySignedPrivateMediaParams({
      kind,
      recordId: id,
      storageKey,
      thumb,
      exp,
      sig,
    });
    if (!signatureOk) {
      throw new ForbiddenError("Signed media link is invalid or expired.");
    }

    const actor = await resolveActorIdentity({ createGuestCookie: false });
    const baseKey = getBaseKeyFromPrivateKey(storageKey);

    if (kind === "draft") {
      const ownerMatches = actor.allOwnerKeys.some((ok) => hashOwnerKey(ok) === id);
      const staffCanView =
        actor.role !== null &&
        (hasPermission(actor.role, "customization:manage") ||
          hasPermission(actor.role, "chat:manage"));
      if (!ownerMatches && !staffCanView) {
        throw new ForbiddenError("Not authorized to view draft media.");
      }
      if (!baseKey.includes(`/${id}/`)) {
        throw new ForbiddenError("Draft media key mismatch.");
      }
    } else if (kind === "customization") {
      const request = await db.customizationRequest.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          guestToken: true,
          images: {
            where: { storageKey: baseKey },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!request) throw new NotFoundError("Customization request not found.");
      assertCustomerOrGuestOwnership(actor, request, "customization:manage");
      if (request.images.length === 0) throw new NotFoundError("Requested media image not found.");
    } else if (kind === "chat") {
      const conv = await db.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          guestToken: true,
          attachments: {
            where: { storageKey: baseKey },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!conv) throw new NotFoundError("Conversation not found.");
      assertCustomerOrGuestOwnership(actor, conv, "chat:manage");
      if (conv.attachments.length === 0) throw new NotFoundError("Requested attachment not found.");
    }

    const bytes = await readPrivateMediaBuffer(storageKey);
    if (!bytes) {
      throw new NotFoundError("Media file is no longer available.");
    }

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (err) {
    return jsonApiError(err);
  }
}
