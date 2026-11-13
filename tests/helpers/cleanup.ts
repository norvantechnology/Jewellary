import { releaseOrderReservationById } from "@/modules/orders/order.service";
import { db } from "@/server/db";

/**
 * Deletes test orders after releasing any stock they still hold. Deleting a pending order
 * directly would leave its quantity stuck in `reservedQty`, slowly "selling out" demo stock.
 */
export async function deleteTestOrders(orderIds: string[]) {
  if (orderIds.length === 0) return;
  for (const id of orderIds) {
    await db
      .$transaction((tx) => releaseOrderReservationById(tx, id, "CANCELLED", "Test cleanup"))
      .catch(() => undefined);
  }
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
}
