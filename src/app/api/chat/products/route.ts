import { NextResponse } from "next/server";
import {
  listShareableCustomerItemsForChat,
  searchShareableProductsForChatPage,
} from "@/modules/chat/chat.service";
import { resolveActorIdentity } from "@/server/customer-identity";
import { jsonApiError } from "@/server/private-media-http";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? "";
    const cursor = url.searchParams.get("cursor");
    const limitParam = Number(url.searchParams.get("limit") ?? 20);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 40) : 20;
    const includeCustomer = url.searchParams.get("includeCustomer") === "1" && !cursor && !q.trim();

    const [productPage, customerItems] = await Promise.all([
      searchShareableProductsForChatPage(q, { limit, cursor }),
      includeCustomer
        ? resolveActorIdentity({ createGuestCookie: false }).then((actor) =>
            listShareableCustomerItemsForChat(actor),
          )
        : Promise.resolve(null),
    ]);

    return NextResponse.json(
      {
        ok: true,
        data: {
          products: productPage.items,
          nextCursor: productPage.nextCursor,
          requests: customerItems?.requests ?? [],
          orders: customerItems?.orders ?? [],
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    return jsonApiError(err);
  }
}
