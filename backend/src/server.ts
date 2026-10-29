import "dotenv/config";
import { readConfig } from "./config";
import { serve } from "./runtime";

void (async () => {
  await serve(readConfig());
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
