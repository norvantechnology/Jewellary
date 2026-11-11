import "server-only";
import { z } from "zod";
import type { Permission, UserRole } from "@/lib/permissions";
import { writeAuditLog } from "@/server/audit";
import {
  getOptionalSession,
  requirePermission,
  requireRole,
  requireUser,
  type AuthenticatedContext,
} from "@/server/dal";
import { AppError } from "@/server/errors";
import { logger } from "@/server/logger";
import { enforceRateLimit, getClientIp, type RateLimitTier } from "@/server/rate-limit";

export type ActionFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};

export type ActionSuccess<T> = {
  ok: true;
  data: T;
};

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export interface ActionContext {
  auth: AuthenticatedContext | null;
  ip: string;
}

export interface CreateActionConfig<TSchema extends z.ZodTypeAny, TOutput> {
  name: string;
  schema: TSchema;
  auth?: "public" | "required" | { minRole: UserRole } | { permission: Permission };
  rateLimit?: {
    tier: RateLimitTier;
    key?: (input: z.infer<TSchema>, ctx: ActionContext) => string;
  };
  audit?: {
    action: string;
    entityType: string;
    entityId?: (input: z.infer<TSchema>, result: TOutput) => string | undefined;
    after?: (input: z.infer<TSchema>, result: TOutput) => unknown;
  };
}

export function createAction<TSchema extends z.ZodTypeAny, TOutput>(
  config: CreateActionConfig<TSchema, TOutput>,
  handler: (input: z.infer<TSchema>, ctx: ActionContext) => Promise<TOutput>,
): (rawInput: z.input<TSchema>) => Promise<ActionResult<TOutput>> {
  return async (rawInput: z.input<TSchema>): Promise<ActionResult<TOutput>> => {
    try {
      const ip = await getClientIp();
      let authCtx: AuthenticatedContext | null = null;

      if (config.auth === "required") {
        authCtx = await requireUser();
      } else if (config.auth && typeof config.auth === "object" && "minRole" in config.auth) {
        authCtx = await requireRole(config.auth.minRole);
      } else if (config.auth && typeof config.auth === "object" && "permission" in config.auth) {
        authCtx = await requirePermission(config.auth.permission);
      } else {
        authCtx = await getOptionalSession();
      }

      const parsed = config.schema.safeParse(rawInput);
      if (!parsed.success) {
        const flat = z.flattenError(parsed.error);
        const fieldErrors: Record<string, string[]> = {};
        for (const [k, msgs] of Object.entries(flat.fieldErrors)) {
          if (Array.isArray(msgs) && msgs.length > 0) {
            fieldErrors[k] = msgs;
          }
        }
        return {
          ok: false,
          error: {
            code: "VALIDATION_ERROR",
            message: flat.formErrors[0] ?? "Please review the highlighted fields.",
            fieldErrors,
          },
        };
      }

      const ctx: ActionContext = { auth: authCtx, ip };

      if (config.rateLimit) {
        const rlKey = config.rateLimit.key
          ? config.rateLimit.key(parsed.data, ctx)
          : (authCtx?.user.id ?? ip);
        await enforceRateLimit(config.rateLimit.tier, rlKey);
      }

      const result = await handler(parsed.data, ctx);

      if (config.audit) {
        await writeAuditLog({
          actorId: authCtx?.user.id ?? null,
          actorEmail: authCtx?.user.email ?? null,
          actorRole: authCtx?.user.role ?? null,
          action: config.audit.action,
          entityType: config.audit.entityType,
          entityId: config.audit.entityId?.(parsed.data, result) ?? null,
          after: config.audit.after ? config.audit.after(parsed.data, result) : parsed.data,
          ipAddress: ip,
        });
      }

      return { ok: true, data: result };
    } catch (error) {
      if (error instanceof AppError) {
        return {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            fieldErrors: error.fieldErrors,
          },
        };
      }

      logger.error(
        {
          action: config.name,
          err: error instanceof Error ? error.message : String(error),
        },
        "Unhandled server action error",
      );

      return {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong while processing your request. Please try again.",
        },
      };
    }
  };
}
