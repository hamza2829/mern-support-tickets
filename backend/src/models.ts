import { Schema, model, Types } from "mongoose";

export const STATUSES = ["open", "in progress", "done"] as const;
export const PRIORITIES = ["low", "normal", "high"] as const;
export type Role = "customer" | "agent";
export interface UserProfile {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: Role;
}

const userSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "agent"], required: true },
  },
  { timestamps: true, versionKey: false },
);

const ticketSchema = new Schema(
  {
    title: { type: String, required: true, minlength: 3, maxlength: 120 },
    description: {
      type: String,
      required: true,
      minlength: 10,
      maxlength: 5000,
    },
    priority: {
      type: String,
      enum: PRIORITIES,
      default: "normal",
      required: true,
    },
    status: { type: String, enum: STATUSES, default: "open", required: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, versionKey: false },
);
ticketSchema.index({ owner: 1, createdAt: -1, _id: -1 });
ticketSchema.index({ status: 1, priority: 1, createdAt: -1 });

const commentSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: "Ticket", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true, versionKey: false },
);
commentSchema.index({ ticket: 1, createdAt: -1, _id: -1 });

export const User = model("User", userSchema);
export const Ticket = model("Ticket", ticketSchema);
export const Comment = model("Comment", commentSchema);

// Explicit response shapes prevent password hashes and ODM metadata leaking to clients.
export function userDto(user: UserProfile | null) {
  return user
    ? {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      }
    : null;
}

export function ticketDto(ticket: {
  _id: Types.ObjectId;
  title: string;
  description: string;
  status: string;
  priority: string;
  owner: UserProfile | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: ticket._id.toString(),
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    owner: userDto(ticket.owner),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

export function commentDto(comment: {
  _id: Types.ObjectId;
  body: string;
  author: UserProfile | null;
  createdAt: Date;
}) {
  return {
    id: comment._id.toString(),
    body: comment.body,
    author: userDto(comment.author),
    createdAt: comment.createdAt.toISOString(),
  };
}
