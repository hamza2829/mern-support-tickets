import type { ErrorRequestHandler } from "express";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function validate<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.output<T> {
  return schema.parse(input);
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    res
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Please check the submitted fields.",
          details: error.issues.map((i) => ({
            field: i.path.join(".") || "body",
            message: i.message,
          })),
        },
      });
    return;
  }
  if (error instanceof ApiError) {
    res
      .status(error.status)
      .json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error?.type === "entity.parse.failed") {
    res
      .status(400)
      .json({
        error: {
          code: "INVALID_JSON",
          message: "Request body must contain valid JSON.",
        },
      });
    return;
  }
  if (error?.type === "entity.too.large") {
    res
      .status(413)
      .json({
        error: {
          code: "BODY_TOO_LARGE",
          message: "Request body exceeds the 32 KB limit.",
        },
      });
    return;
  }
  console.error("Unhandled API error:", error);
  res
    .status(500)
    .json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    });
};
