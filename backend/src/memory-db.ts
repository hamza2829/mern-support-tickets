import { MongoMemoryServer } from "mongodb-memory-server";
import { resolve } from "node:path";

export function startMemoryDatabase() {
  return MongoMemoryServer.create({
    binary: {
      version: "8.2.6",
      downloadDir: resolve(process.cwd(), ".cache", "mongodb"),
    },
    instance: { ip: "127.0.0.1" },
  });
}
