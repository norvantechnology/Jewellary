import { NextResponse } from "next/server";
import { AppError } from "@/server/errors";

export function apiErrorResponse(err: unknown, fallbackMessage = "Request failed.") {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.statusCode },
    );
  }

  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: fallbackMessage } },
    { status: 500 },
  );
}
