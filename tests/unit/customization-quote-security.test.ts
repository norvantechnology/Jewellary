// @vitest-environment node
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { MAX_CUSTOMER_IMAGE_UPLOAD_BYTES } from "@/lib/constants";
import { chatAttachmentInputSchema, sendMessageSchema } from "@/modules/chat/chat.schemas";
import { hashQuoteToken } from "@/modules/customization/customization.service";
import {
  createSignedPrivateMediaUrl,
  verifySignedPrivateMediaParams,
} from "@/server/private-media";

describe("Customization quote tokens, private media signatures & chat security validation", () => {
  it("hashes quote acceptance tokens deterministically with SHA-256", () => {
    const raw = crypto.randomBytes(32).toString("base64url");
    const h1 = hashQuoteToken(raw);
    const h2 = hashQuoteToken(raw);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(raw);
    expect(h1).toHaveLength(64);
  });

  it("signs and verifies time-bound private media URLs and rejects tampered params", () => {
    const storageKey = "chat/ownerhash/sample_123.webp";
    const { url } = createSignedPrivateMediaUrl({
      kind: "chat",
      recordId: "att_123",
      storageKey,
      ttlSeconds: 300,
    });

    const parsed = new URL(url, "http://localhost");
    const exp = parsed.searchParams.get("exp");
    const sig = parsed.searchParams.get("sig");

    expect(
      verifySignedPrivateMediaParams({
        kind: "chat",
        recordId: "att_123",
        storageKey,
        thumb: false,
        exp,
        sig,
      }),
    ).toBe(true);

    expect(
      verifySignedPrivateMediaParams({
        kind: "customization",
        recordId: "att_123",
        storageKey,
        thumb: false,
        exp,
        sig,
      }),
    ).toBe(false);

    expect(
      verifySignedPrivateMediaParams({
        kind: "chat",
        recordId: "att_other",
        storageKey,
        thumb: false,
        exp,
        sig,
      }),
    ).toBe(false);

    expect(
      verifySignedPrivateMediaParams({
        kind: "chat",
        recordId: "att_123",
        storageKey,
        thumb: false,
        exp: String(Date.now() - 10_000),
        sig,
      }),
    ).toBe(false);
  });

  it("enforces chat message attachment size & count limits cleanly", () => {
    const okMsg = sendMessageSchema.safeParse({
      conversationId: "conv_1",
      type: "TEXT",
      body: "Hello concierge",
      attachments: [],
    });
    expect(okMsg.success).toBe(true);

    const tooManyAttachments = sendMessageSchema.safeParse({
      conversationId: "conv_1",
      type: "IMAGE",
      body: "Photos",
      attachments: Array.from({ length: 6 }).map((_, i) => ({
        storageKey: `chat/hash/a${i}.webp`,
        sizeBytes: 1024,
      })),
    });
    expect(tooManyAttachments.success).toBe(false);

    const oversized = chatAttachmentInputSchema.safeParse({
      storageKey: "chat/hash/huge.webp",
      sizeBytes: MAX_CUSTOMER_IMAGE_UPLOAD_BYTES + 1,
    });
    expect(oversized.success).toBe(false);
  });
});
