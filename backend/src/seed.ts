import "dotenv/config";
import mongoose from "mongoose";
import { readConfig } from "./config";
import { seedData } from "./seed-data";

void (async () => {
  const config = readConfig();
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  await seedData();
  console.log(
    "Synthetic demo accounts are available; tickets added only if the collection was empty.",
  );
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
