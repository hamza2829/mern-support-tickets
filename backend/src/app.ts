import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { AppConfig } from "./config";
import { authenticate, identity, issueToken, type Identity } from "./auth";
import { ApiError, errorHandler, validate } from "./errors";
import {
  User,
  Ticket,
  Comment,
  STATUSES,
  PRIORITIES,
  userDto,
  ticketDto,
  commentDto,
  type UserProfile,
} from "./models";

const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8)
    .max(72)
    .refine(
      (v) => Buffer.byteLength(v, "utf8") <= 72,
      "Password exceeds 72 bytes",
    ),
});
const ticketSchema = z.strictObject({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(5000),
  priority: z.enum(PRIORITIES).default("normal"),
});
const pagination = {
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
};
const listSchema = z.strictObject({
  ...pagination,
  q: z.string().trim().max(100).optional(),
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
});
const idSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Ticket ID must be 24 hexadecimal characters");
const dummyHash = bcrypt.hashSync("not-a-real-account-password", 10);
const population = { path: "owner", select: "name email role" };
const authorPopulation = { path: "author", select: "name email role" };

async function accessibleTicket(id: unknown, user: Identity) {
  const ticketId = validate(idSchema, id);
  const ticket = await Ticket.findOne({
    _id: ticketId,
    ...(user.role === "customer" ? { owner: user.id } : {}),
  });
  // Identical response for absent and other customers' tickets avoids disclosing their existence.
  if (!ticket) throw new ApiError(404, "NOT_FOUND", "Ticket not found.");
  return ticket;
}

function pageDto<T>(items: T[], total: number, page: number, limit: number) {
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export function createApp(config: AppConfig) {
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  app.use(helmet());
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => {
    if (mongoose.connection.readyState !== 1) {
      res
        .status(503)
        .json({
          error: { code: "NOT_READY", message: "Database is not connected." },
        });
      return;
    }
    res.json({ status: "ok", database: "connected" });
  });
  const spec = JSON.parse(
    readFileSync(join(__dirname, "..", "openapi.json"), "utf8"),
  );
  app.get("/api/openapi.json", (_req, res) => {
    res.json(spec);
  });

  const loginLimiter = rateLimit({
    windowMs: config.loginWindowMs ?? 5 * 60 * 1000,
    limit: config.loginLimit ?? 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many sign-in attempts. Please try again later.",
        },
      });
    },
  });
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    const input = validate(loginSchema, req.body);
    const user = await User.findOne({ email: input.email }).select(
      "+passwordHash",
    );
    const matches = await bcrypt.compare(
      input.password,
      user?.passwordHash ?? dummyHash,
    );
    if (!user || !matches)
      throw new ApiError(
        401,
        "INVALID_CREDENTIALS",
        "Email or password is incorrect.",
      );
    res.json({
      token: issueToken(user.id, config),
      expiresIn: 3600,
      user: userDto({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role as "customer" | "agent",
      }),
    });
  });

  app.use("/api", authenticate(config));
  app.get("/api/auth/me", (req, res) => {
    res.json({ user: identity(req) });
  });

  app.get("/api/tickets", async (req, res) => {
    const user = identity(req);
    const { page, limit, status, priority, q } = validate(
      listSchema,
      req.query,
    );
    // Build the filter ourselves. Never pass a request object directly to Mongoose.
    const filter: mongoose.QueryFilter<typeof Ticket> = {};
    if (user.role === "customer") filter.owner = user.id;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const search = new RegExp(escaped, "i");
      filter.$or = [{ title: search }, { description: search }];
    }
    const [tickets, total] = await Promise.all([
      Ticket.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate<{ owner: UserProfile | null }>(population),
      Ticket.countDocuments(filter),
    ]);
    res.json(pageDto(tickets.map(ticketDto), total, page, limit));
  });

  app.post("/api/tickets", async (req, res) => {
    const input = validate(ticketSchema, req.body);
    const ticket = await Ticket.create({
      ...input,
      owner: identity(req).id,
      status: "open",
    });
    res
      .status(201)
      .json({
        ticket: ticketDto(
          await ticket.populate<{ owner: UserProfile | null }>(population),
        ),
      });
  });

  app.get("/api/tickets/:id", async (req, res) => {
    const ticket = await accessibleTicket(req.params.id, identity(req));
    res.json({
      ticket: ticketDto(
        await ticket.populate<{ owner: UserProfile | null }>(population),
      ),
    });
  });

  app.patch("/api/tickets/:id/status", async (req, res) => {
    if (identity(req).role !== "agent")
      throw new ApiError(
        403,
        "FORBIDDEN",
        "Only agents can change ticket status.",
      );
    const id = validate(idSchema, req.params.id);
    const { status } = validate(
      z.strictObject({ status: z.enum(STATUSES) }),
      req.body,
    );
    const ticket = await Ticket.findByIdAndUpdate(
      id,
      { $set: { status } },
      { returnDocument: "after", runValidators: true },
    ).populate<{ owner: UserProfile | null }>(population);
    if (!ticket) throw new ApiError(404, "NOT_FOUND", "Ticket not found.");
    res.json({ ticket: ticketDto(ticket) });
  });

  app.get("/api/tickets/:id/comments", async (req, res) => {
    const ticket = await accessibleTicket(req.params.id, identity(req));
    const { page, limit } = validate(z.strictObject(pagination), req.query);
    const [comments, total] = await Promise.all([
      Comment.find({ ticket: ticket._id })
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate<{ author: UserProfile | null }>(authorPopulation),
      Comment.countDocuments({ ticket: ticket._id }),
    ]);
    res.json(pageDto(comments.map(commentDto), total, page, limit));
  });

  app.post("/api/tickets/:id/comments", async (req, res) => {
    const ticket = await accessibleTicket(req.params.id, identity(req));
    const { body } = validate(
      z.strictObject({ body: z.string().trim().min(1).max(2000) }),
      req.body,
    );
    const comment = await Comment.create({
      ticket: ticket._id,
      author: identity(req).id,
      body,
    });
    res
      .status(201)
      .json({
        comment: commentDto(
          await comment.populate<{ author: UserProfile | null }>(
            authorPopulation,
          ),
        ),
      });
  });

  app.use((_req, _res, next) => {
    next(new ApiError(404, "NOT_FOUND", "Endpoint not found."));
  });
  app.use(errorHandler);
  return app;
}
