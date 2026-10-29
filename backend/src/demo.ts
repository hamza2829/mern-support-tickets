import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { startMemoryDatabase } from "./memory-db";
import { seedData } from "./seed-data";
import { serve } from "./runtime";

void (async () => {
  const database = await startMemoryDatabase();
  try {
    const mongoUri = database.getUri("support_demo");
    await mongoose.connect(mongoUri);
    await seedData();
    await mongoose.disconnect();
    await serve(
      {
        mongoUri,
        port: 4000,
        jwtSecret: randomBytes(32).toString("hex"),
        clientOrigin: "http://127.0.0.1:5173",
      },
      () => database.stop().then(() => undefined),
    );
    console.log(
      "Temporary synthetic demo. All data is discarded on exit. Password: DemoPass123!",
    );
  } catch (error) {
    await mongoose.disconnect();
    await database.stop();
    throw error;
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
