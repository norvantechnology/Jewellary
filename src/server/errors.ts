import "server-only";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "OUT_OF_STOCK"
  | "RATE_LIMITED"
  | "PAYMENT_ERROR"
  | "INTERNAL_ERROR";

/**
 * Base application error mapped cleanly to HTTP responses and ActionResult objects.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.statusCode = statusCode;
    this.fieldErrors = fieldErrors;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input provided.", fieldErrors?: Record<string, string[]>) {
    super("VALIDATION_ERROR", message, 400, fieldErrors);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.") {
    super("UNAUTHORIZED", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action.") {
    super("FORBIDDEN", message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested resource could not be found.") {
    super("NOT_FOUND", message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "A conflicting record already exists.") {
    super("CONFLICT", message, 409);
  }
}

export class OutOfStockError extends AppError {
  constructor(message = "One or more selected items are out of stock.") {
    super("OUT_OF_STOCK", message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again shortly.") {
    super("RATE_LIMITED", message, 429);
  }
}

export class PaymentError extends AppError {
  constructor(message = "Payment could not be processed. Please try again.") {
    super("PAYMENT_ERROR", message, 402);
  }
}
