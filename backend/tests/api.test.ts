import request from "supertest";
import mongoose, { Types } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import os from "node:os";
import { createApp } from "../src/app";
import { User, Ticket, Comment } from "../src/models";
import { issueToken, ISSUER, AUDIENCE } from "../src/auth";
import { startMemoryDatabase } from "../src/memory-db";
import { readConfig } from "../src/config";
import { seedData } from "../src/seed-data";

const config = {
  jwtSecret: "test-only-secret-with-more-than-32-characters",
  clientOrigin: "http://127.0.0.1:5173",
  loginLimit: 1000,
};
const password = "DemoPass123!";
let database: Awaited<ReturnType<typeof startMemoryDatabase>>;
let app: ReturnType<typeof createApp>;
let alice: string, bruno: string, agent: string, aliceId: string;
let own: string, other: string, second: string;
let hash: string;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const validTicket = {
  title: "Export is incomplete",
  description: "The report export does not include the expected columns.",
};

beforeAll(async () => {
  database = await startMemoryDatabase();
  // Explicit OS adapter avoids the driver's dynamic-import bug in Jest's VM.
  // Upstream: https://jira.mongodb.org/browse/NODE-7832 (no database mocking).
  await mongoose.connect(database.getUri("support_tests"), {
    runtimeAdapters: { os },
    serverSelectionTimeoutMS: 10000,
  });
  await Promise.all([User.init(), Ticket.init(), Comment.init()]);
  hash = await bcrypt.hash(password, 4); // faster fixture hashing; demo seed uses cost 10
});
beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Ticket.deleteMany({}),
    Comment.deleteMany({}),
  ]);
  const users = await User.create([
    {
      name: "Alice Test",
      email: "alice@example.test",
      role: "customer",
      passwordHash: hash,
    },
    {
      name: "Bruno Test",
      email: "bruno@example.test",
      role: "customer",
      passwordHash: hash,
    },
    {
      name: "Agent Test",
      email: "agent@example.test",
      role: "agent",
      passwordHash: hash,
    },
  ]);
  aliceId = users[0].id;
  [alice, bruno, agent] = users.map((u) => issueToken(u.id, config));
  const tickets = await Ticket.create([
    { ...validTicket, owner: users[0]._id, status: "open", priority: "high" },
    {
      title: "Invoice export [copy]",
      description: "This description mentions a refund and its reconciliation.",
      owner: users[1]._id,
      status: "done",
      priority: "normal",
    },
    {
      title: "Invite a teammate",
      description: "The invitation form is not accepting a valid test address.",
      owner: users[0]._id,
      status: "in progress",
      priority: "low",
    },
  ]);
  [own, other, second] = tickets.map((t) => t.id);
  app = createApp(config); // fresh in-memory rate limiter for each test
});
afterAll(async () => {
  await mongoose.disconnect();
  await database?.stop();
});

describe("health, documentation and configuration", () => {
  test("demo seed is repeatable without replacing existing records or passwords", async () => {
    await Promise.all([
      User.deleteMany({}),
      Ticket.deleteMany({}),
      Comment.deleteMany({}),
    ]);
    await seedData();
    const account = await User.findOne({ email: "alice@example.test" }).select(
      "+passwordHash",
    );
    const first = await Ticket.findOne();
    await Ticket.updateOne({ _id: first!._id }, { $set: { status: "done" } });
    await seedData();
    expect(await User.countDocuments()).toBe(3);
    expect(await Ticket.countDocuments()).toBe(12);
    expect(await Comment.countDocuments()).toBe(4);
    expect(
      (await User.findById(account!._id).select("+passwordHash"))?.passwordHash,
    ).toBe(account!.passwordHash);
    expect((await Ticket.findById(first!._id))?.status).toBe("done");
    expect(
      (await Ticket.findOne().sort({ createdAt: -1 }))!.createdAt.getTime(),
    ).toBeLessThan(Date.now());
  });
  test("health reports the real database connection", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body).toEqual({ status: "ok", database: "connected" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
  test("serves the OpenAPI contract without authentication", async () => {
    const response = await request(app).get("/api/openapi.json").expect(200);
    expect(response.body.openapi).toBe("3.0.3");
    expect(response.body.paths["/tickets/{id}/comments"].post.operationId).toBe(
      "addComment",
    );
  });
  test("refuses missing secrets without disclosing environment values", () => {
    expect(() =>
      readConfig({ MONGO_URI: "mongodb://localhost/test", JWT_SECRET: "" }),
    ).toThrow("JWT_SECRET");
  });
});

describe("login and JWT access", () => {
  test.each(["alice", "agent"])(
    "logs in the %s account without exposing its password hash",
    async (name) => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: `${name}@example.test`, password })
        .expect(200);
      expect(response.body.user.role).toBe(
        name === "agent" ? "agent" : "customer",
      );
      expect(response.body.expiresIn).toBe(3600);
      expect(JSON.stringify(response.body)).not.toContain("passwordHash");
      await request(app)
        .get("/api/auth/me")
        .set(auth(response.body.token))
        .expect(200);
    },
  );
  test("normalizes email whitespace and casing", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: "  ALICE@example.test ", password })
      .expect(200);
  });
  test("unknown email and wrong password return the same generic error", async () => {
    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.test", password: "WrongPass123!" })
      .expect(401);
    const absent = await request(app)
      .post("/api/auth/login")
      .send({ email: "absent@example.test", password })
      .expect(401);
    expect(wrong.body).toEqual(absent.body);
  });
  test.each([
    { email: "alice@example.test" },
    { email: { $ne: null }, password },
    { email: "alice@example.test", password, role: "agent" },
  ])("rejects malformed or extra login fields: %j", async (input) => {
    await request(app).post("/api/auth/login").send(input).expect(400);
  });
  test("limits login attempts", async () => {
    const limited = createApp({ ...config, loginLimit: 2 });
    for (let i = 0; i < 2; i++)
      await request(limited)
        .post("/api/auth/login")
        .send({ email: "absent@example.test", password })
        .expect(401);
    const response = await request(limited)
      .post("/api/auth/login")
      .send({ email: "absent@example.test", password })
      .expect(429);
    expect(response.body.error.code).toBe("TOO_MANY_REQUESTS");
  });
  test("rejects missing tokens", async () => {
    await request(app).get("/api/tickets").expect(401);
  });
  test("rejects forged signatures", async () => {
    await request(app)
      .get("/api/tickets")
      .set(auth(jwt.sign({}, "a-different-secret", { subject: aliceId })))
      .expect(401);
  });
  test.each([
    {
      expiresIn: -10,
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithm: "HS256" as const,
    },
    {
      expiresIn: 3600,
      issuer: "other-app",
      audience: AUDIENCE,
      algorithm: "HS256" as const,
    },
    {
      expiresIn: 3600,
      issuer: ISSUER,
      audience: "other-client",
      algorithm: "HS256" as const,
    },
    {
      expiresIn: 3600,
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithm: "HS512" as const,
    },
  ])("rejects invalid token claims/algorithm: %j", async (options) => {
    const token = jwt.sign({}, config.jwtSecret, {
      ...options,
      subject: aliceId,
    });
    await request(app).get("/api/tickets").set(auth(token)).expect(401);
  });
  test("rejects a token whose user was deleted", async () => {
    await User.findByIdAndDelete(aliceId);
    await request(app).get("/api/tickets").set(auth(alice)).expect(401);
  });
  test("uses the database role rather than an extra JWT role claim", async () => {
    const token = jwt.sign({ role: "agent" }, config.jwtSecret, {
      subject: aliceId,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: 3600,
    });
    await request(app)
      .patch(`/api/tickets/${own}/status`)
      .set(auth(token))
      .send({ status: "done" })
      .expect(403);
  });
});

describe("create and list tickets", () => {
  test("creates an open ticket owned by the signed-in customer", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set(auth(alice))
      .send(validTicket)
      .expect(201);
    expect(response.body.ticket).toMatchObject({
      ...validTicket,
      status: "open",
      priority: "normal",
      owner: { id: aliceId },
    });
    expect(
      (await Ticket.findById(response.body.ticket.id))?.owner.toString(),
    ).toBe(aliceId);
  });
  test("allows an agent to create a ticket owned by that agent", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set(auth(agent))
      .send(validTicket)
      .expect(201);
    expect(response.body.ticket.owner.role).toBe("agent");
  });
  test("trims valid ticket text", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set(auth(alice))
      .send({ ...validTicket, title: "  Trim this title  " })
      .expect(201);
    expect(response.body.ticket.title).toBe("Trim this title");
  });
  test.each([
    { ...validTicket, title: "  " },
    { ...validTicket, description: "short" },
    { ...validTicket, priority: "urgent" },
    { title: validTicket.title },
    { ...validTicket, title: "a".repeat(121) },
    { ...validTicket, owner: "someone-else", status: "done" },
  ])(
    "validates ticket fields and rejects mass assignment: %j",
    async (input) => {
      const response = await request(app)
        .post("/api/tickets")
        .set(auth(alice))
        .send(input)
        .expect(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(await Ticket.countDocuments()).toBe(3);
    },
  );
  test("customers see only their own records and scoped totals", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .set(auth(alice))
      .expect(200);
    expect(response.body.total).toBe(2);
    expect(
      response.body.items.every(
        (t: { owner: { id: string } }) => t.owner.id === aliceId,
      ),
    ).toBe(true);
  });
  test("agents see the full queue", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .set(auth(agent))
      .expect(200);
    expect(response.body.total).toBe(3);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });
  test("combines status and priority filters", async () => {
    const response = await request(app)
      .get("/api/tickets?status=open&priority=high")
      .set(auth(agent))
      .expect(200);
    expect(response.body.items.map((t: { id: string }) => t.id)).toEqual([own]);
  });
  test.each(["INVOICE", "refund"])(
    "searches title or description case-insensitively: %s",
    async (q) => {
      const response = await request(app)
        .get("/api/tickets")
        .query({ q })
        .set(auth(agent))
        .expect(200);
      expect(response.body.items.map((t: { id: string }) => t.id)).toEqual([
        other,
      ]);
    },
  );
  test("escapes search regex metacharacters", async () => {
    const response = await request(app)
      .get("/api/tickets")
      .query({ q: "[" })
      .set(auth(agent))
      .expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].id).toBe(other);
  });
  test("search cannot escape customer scope", async () => {
    const response = await request(app)
      .get("/api/tickets?q=refund")
      .set(auth(alice))
      .expect(200);
    expect(response.body.total).toBe(0);
  });
  test("paginates consistently without duplicate records", async () => {
    const first = await request(app)
      .get("/api/tickets?limit=1&page=1")
      .set(auth(agent))
      .expect(200);
    const next = await request(app)
      .get("/api/tickets?limit=1&page=2")
      .set(auth(agent))
      .expect(200);
    expect(first.body.totalPages).toBe(3);
    expect(first.body.items[0].id).not.toBe(next.body.items[0].id);
  });
  test.each([
    "page=0",
    "limit=51",
    "status=closed",
    "q=" + "a".repeat(101),
    "status[$ne]=done",
    "owner=someone",
    "priority=low&priority=high",
  ])("rejects invalid/unapproved query: %s", async (query) => {
    await request(app)
      .get(`/api/tickets?${query}`)
      .set(auth(agent))
      .expect(400);
  });
});

describe("ticket detail and comments", () => {
  test("reads an owned ticket", async () => {
    await request(app).get(`/api/tickets/${own}`).set(auth(alice)).expect(200);
  });
  test("agents can read another user’s ticket", async () => {
    await request(app)
      .get(`/api/tickets/${other}`)
      .set(auth(agent))
      .expect(200);
  });
  test("other customers receive the same 404 as a missing ticket", async () => {
    const hidden = await request(app)
      .get(`/api/tickets/${other}`)
      .set(auth(alice))
      .expect(404);
    const missing = await request(app)
      .get(`/api/tickets/${new Types.ObjectId()}`)
      .set(auth(alice))
      .expect(404);
    expect(hidden.body).toEqual(missing.body);
  });
  test("malformed IDs return a clear 400", async () => {
    await request(app)
      .get("/api/tickets/not-an-id")
      .set(auth(alice))
      .expect(400);
  });
  test("customers can add their own comments with server-assigned authors", async () => {
    const response = await request(app)
      .post(`/api/tickets/${own}/comments`)
      .set(auth(alice))
      .send({ body: "  More detail for the team.  " })
      .expect(201);
    expect(response.body.comment).toMatchObject({
      body: "More detail for the team.",
      author: { id: aliceId },
    });
    expect(await Comment.countDocuments({ ticket: own })).toBe(1);
  });
  test("agents can comment on any ticket", async () => {
    await request(app)
      .post(`/api/tickets/${other}/comments`)
      .set(auth(agent))
      .send({ body: "I can help." })
      .expect(201);
  });
  test("other customers cannot read or write comments", async () => {
    await request(app)
      .get(`/api/tickets/${own}/comments`)
      .set(auth(bruno))
      .expect(404);
    await request(app)
      .post(`/api/tickets/${own}/comments`)
      .set(auth(bruno))
      .send({ body: "Not mine." })
      .expect(404);
    expect(await Comment.countDocuments()).toBe(0);
  });
  test.each([
    { body: "   " },
    { body: "a".repeat(2001) },
    { body: "Text", author: "forged" },
  ])("validates comments and rejects forged fields", async (input) => {
    await request(app)
      .post(`/api/tickets/${own}/comments`)
      .set(auth(alice))
      .send(input)
      .expect(400);
  });
  test("comment pagination includes public authors without hashes", async () => {
    for (const body of ["First comment", "Second comment", "Third comment"])
      await request(app)
        .post(`/api/tickets/${own}/comments`)
        .set(auth(alice))
        .send({ body })
        .expect(201);
    const response = await request(app)
      .get(`/api/tickets/${own}/comments?limit=2`)
      .set(auth(agent))
      .expect(200);
    expect(response.body.total).toBe(3);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0].body).toBe("Third comment");
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });
});

describe("agent status updates and error responses", () => {
  test("customers cannot change even their own ticket status", async () => {
    await request(app)
      .patch(`/api/tickets/${own}/status`)
      .set(auth(alice))
      .send({ status: "done" })
      .expect(403);
    expect((await Ticket.findById(own))?.status).toBe("open");
  });
  test.each(["open", "in progress", "done"])(
    "agents can set status to %s",
    async (status) => {
      const response = await request(app)
        .patch(`/api/tickets/${other}/status`)
        .set(auth(agent))
        .send({ status })
        .expect(200);
      expect(response.body.ticket.status).toBe(status);
      expect((await Ticket.findById(other))?.status).toBe(status);
    },
  );
  test("invalid status is rejected", async () => {
    await request(app)
      .patch(`/api/tickets/${own}/status`)
      .set(auth(agent))
      .send({ status: "closed" })
      .expect(400);
  });
  test("a missing ticket cannot be updated", async () => {
    await request(app)
      .patch(`/api/tickets/${new Types.ObjectId()}/status`)
      .set(auth(agent))
      .send({ status: "done" })
      .expect(404);
  });
  test("malformed JSON returns a stable error instead of a stack trace", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .set(auth(alice))
      .set("Content-Type", "application/json")
      .send("{broken")
      .expect(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
    expect(response.body).not.toHaveProperty("stack");
  });
  test("oversized JSON is rejected before persistence", async () => {
    await request(app)
      .post("/api/tickets")
      .set(auth(alice))
      .send({ ...validTicket, description: "a".repeat(33000) })
      .expect(413);
    expect(await Ticket.countDocuments()).toBe(3);
  });
  test("unknown authenticated endpoints return JSON 404", async () => {
    await request(app)
      .get("/api/missing")
      .set(auth(alice))
      .expect(404)
      .expect("Content-Type", /json/);
  });
});
