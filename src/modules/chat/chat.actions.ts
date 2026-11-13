"use server";

import { z } from "zod";
import { createAction } from "@/server/create-action";
import { resolveActorIdentity } from "@/server/customer-identity";
import { getClientIp } from "@/server/rate-limit";
import {
  adminAddNoteSchema,
  adminCannedReplySchema,
  adminUpdateConversationSchema,
  markReadSchema,
  sendMessageSchema,
  startConversationSchema,
} from "./chat.schemas";
import {
  adminAddConversationNote,
  adminUpdateConversation,
  deleteCannedReply,
  getOrCreateConversation,
  markConversationRead,
  sendChatMessage,
  upsertCannedReply,
} from "./chat.service";

export const startConversationAction = createAction(
  {
    name: "chat.startConversation",
    schema: startConversationSchema,
  },
  async (input) => {
    const actor = await resolveActorIdentity({ createGuestCookie: true });
    return getOrCreateConversation(input, actor);
  },
);

export const sendMessageAction = createAction(
  {
    name: "chat.sendMessage",
    schema: sendMessageSchema,
  },
  async (input) => {
    const actor = await resolveActorIdentity({ createGuestCookie: false });
    const ip = await getClientIp();
    return sendChatMessage(input, actor, ip);
  },
);

export const markConversationReadAction = createAction(
  {
    name: "chat.markRead",
    schema: markReadSchema,
  },
  async (input) => {
    const actor = await resolveActorIdentity({ createGuestCookie: false });
    return markConversationRead(input, actor);
  },
);

export const adminUpdateConversationAction = createAction(
  {
    name: "chat.adminUpdateConversation",
    auth: { permission: "chat:manage" },
    schema: adminUpdateConversationSchema,
  },
  async (input, ctx) => {
    return adminUpdateConversation(input, {
      id: ctx.auth!.user.id,
      email: ctx.auth!.user.email,
      role: ctx.auth!.user.role,
    });
  },
);

export const adminAddConversationNoteAction = createAction(
  {
    name: "chat.adminAddNote",
    auth: { permission: "chat:manage" },
    schema: adminAddNoteSchema,
  },
  async (input, ctx) => {
    return adminAddConversationNote(input, {
      id: ctx.auth!.user.id,
      email: ctx.auth!.user.email,
      name: ctx.auth!.user.name,
      role: ctx.auth!.user.role,
    });
  },
);

export const adminUpsertCannedReplyAction = createAction(
  {
    name: "chat.adminUpsertCannedReply",
    auth: { permission: "chat:manage" },
    schema: adminCannedReplySchema,
  },
  async (input) => {
    return upsertCannedReply(input);
  },
);

export const adminDeleteCannedReplyAction = createAction(
  {
    name: "chat.adminDeleteCannedReply",
    auth: { permission: "chat:manage" },
    schema: z.object({ id: z.string().min(1) }),
  },
  async (input) => {
    return deleteCannedReply(input.id);
  },
);
