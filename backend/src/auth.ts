import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import type { AppConfig } from "./config";
import { ApiError } from "./errors";
import { User, type Role } from "./models";

export const ISSUER = "mern-support-tickets";
export const AUDIENCE = "support-web";
export interface Identity {
  id: string;
  name: string;
  email: string;
  role: Role;
}
declare global {
  namespace Express {
    interface Request {
      user?: Identity;
    }
  }
}

export function issueToken(id: string, config: AppConfig) {
  return jwt.sign({}, config.jwtSecret, {
    subject: id,
    algorithm: "HS256",
    expiresIn: "1h",
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function authenticate(config: AppConfig): RequestHandler {
  return async (req, _res, next) => {
    const match = req.headers.authorization?.match(/^Bearer (\S+)$/i);
    if (!match) throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
    let id: string;
    try {
      const payload = jwt.verify(match[1], config.jwtSecret, {
        algorithms: ["HS256"],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (
        typeof payload === "string" ||
        !z
          .string()
          .regex(/^[a-f\d]{24}$/i)
          .safeParse(payload.sub).success
      ) {
        throw new Error("Invalid subject");
      }
      id = payload.sub!;
    } catch {
      throw new ApiError(
        401,
        "INVALID_TOKEN",
        "Your session is invalid or expired. Sign in again.",
      );
    }
    // Read role from MongoDB on each request; never trust a role supplied by a client.
    const user = await User.findById(id);
    if (!user)
      throw new ApiError(
        401,
        "INVALID_TOKEN",
        "Your account is no longer available.",
      );
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as Role,
    };
    next();
  };
}

export function identity(req: Request): Identity {
  if (!req.user)
    throw new ApiError(401, "UNAUTHORIZED", "Sign in to continue.");
  return req.user;
}
