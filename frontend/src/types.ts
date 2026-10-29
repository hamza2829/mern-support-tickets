export type Status = "open" | "in progress" | "done";
export type Priority = "low" | "normal" | "high";
export interface User {
  id: string;
  name: string;
  email: string;
  role: "customer" | "agent";
}
export interface Session {
  token: string;
  expiresIn: number;
  user: User;
}
export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  owner: User | null;
  createdAt: string;
  updatedAt: string;
}
export interface Comment {
  id: string;
  body: string;
  author: User | null;
  createdAt: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
export interface NewTicket {
  title: string;
  description: string;
  priority: Priority;
}
export interface Filters {
  q: string;
  status: string;
  priority: string;
}
