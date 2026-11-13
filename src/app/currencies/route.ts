import type { NextRequest } from "next/server";
import { handleGetPublicCurrencies } from "@/app/api/currencies/route";

export async function GET(request: NextRequest) {
  return handleGetPublicCurrencies(request);
}
