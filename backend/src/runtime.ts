import mongoose from "mongoose";
import { createApp } from "./app";
import type { AppConfig } from "./config";

export async function serve(
  config: AppConfig & { mongoUri: string; port: number },
  cleanup?: () => Promise<void>,
) {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  const app = createApp(config);
  const server = app.listen(config.port, "127.0.0.1", () => {
    console.log(`API ready: http://127.0.0.1:${config.port}/api/health`);
  });
  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    server.close(async () => {
      await mongoose.disconnect();
      await cleanup?.();
    });
  };
  server.on("error", async (error) => {
    console.error("Cannot start API:", error.message);
    await mongoose.disconnect();
    await cleanup?.();
    process.exitCode = 1;
  });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  return server;
}
