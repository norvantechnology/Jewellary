import "server-only";
import { db } from "@/server/db";
import { sendCartReminderEmail, sendFeedbackRequestEmail } from "@/server/email/send";
import { logger } from "@/server/logger";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BATCH_LIMIT = 50;

function firstName(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first || "there";
}

/**
 * One reminder per abandoned cart: signed-in shoppers (we have their email) whose cart has items,
 * was last touched 4 hours to 7 days ago, and who have not ordered since. A cart edited after a
 * reminder becomes eligible again.
 */
export async function runCartReminderJob(now = new Date()): Promise<{ sent: number }> {
  const carts = await db.cart.findMany({
    where: {
      userId: { not: null },
      updatedAt: {
        lte: new Date(now.getTime() - 4 * HOUR),
        gte: new Date(now.getTime() - 7 * DAY),
      },
      items: { some: {} },
      user: { banned: { not: true }, anonymizedAt: null, emailVerified: true },
    },
    select: {
      id: true,
      userId: true,
      updatedAt: true,
      recoveryEmailSentAt: true,
      user: { select: { email: true, name: true } },
      items: {
        select: { variant: { select: { product: { select: { name: true, status: true } } } } },
      },
    },
    take: BATCH_LIMIT * 2,
  });

  let sent = 0;
  for (const cart of carts) {
    if (sent >= BATCH_LIMIT) break;
    if (!cart.user || !cart.userId) continue;
    if (cart.recoveryEmailSentAt && cart.recoveryEmailSentAt >= cart.updatedAt) continue;

    const orderedSince = await db.order.count({
      where: { userId: cart.userId, createdAt: { gte: cart.updatedAt } },
    });
    if (orderedSince > 0) continue;

    const itemNames = [
      ...new Set(
        cart.items
          .filter((i) => i.variant.product.status === "ACTIVE")
          .map((i) => i.variant.product.name),
      ),
    ];
    if (itemNames.length === 0) continue;

    try {
      await sendCartReminderEmail({
        to: cart.user.email,
        recipientName: firstName(cart.user.name),
        itemNames,
      });
      // Raw update keeps updatedAt unchanged, so later cart edits can be detected.
      await db.$executeRaw`UPDATE "Cart" SET "recoveryEmailSentAt" = ${now}, "updatedAt" = "updatedAt" WHERE id = ${cart.id}`;
      sent += 1;
    } catch (error) {
      logger.warn({ cartId: cart.id, err: String(error) }, "Cart reminder email failed");
    }
  }
  return { sent };
}

/** One feedback request per delivered order, 7 to 30 days after delivery. */
export async function runFeedbackRequestJob(now = new Date()): Promise<{ sent: number }> {
  const orders = await db.order.findMany({
    where: {
      status: "DELIVERED",
      reviewRequestSentAt: null,
      deliveredAt: {
        lte: new Date(now.getTime() - 7 * DAY),
        gte: new Date(now.getTime() - 30 * DAY),
      },
    },
    select: {
      id: true,
      orderNumber: true,
      guestEmail: true,
      shippingAddress: true,
      user: { select: { email: true, name: true } },
    },
    take: BATCH_LIMIT,
  });

  let sent = 0;
  for (const order of orders) {
    const to = order.user?.email ?? order.guestEmail;
    if (!to) continue;
    const shipping = order.shippingAddress as { fullName?: string } | null;
    try {
      await sendFeedbackRequestEmail({
        to,
        recipientName: firstName(order.user?.name ?? shipping?.fullName),
        orderNumber: order.orderNumber,
      });
      await db.order.update({ where: { id: order.id }, data: { reviewRequestSentAt: now } });
      sent += 1;
    } catch (error) {
      logger.warn({ orderId: order.id, err: String(error) }, "Feedback request email failed");
    }
  }
  return { sent };
}
