import { z } from "zod";

export interface AppConfig {
  jwtSecret: string;
  clientOrigin: string;
  loginLimit?: number;
  loginWindowMs?: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = z
    .object({
      MONGO_URI: z
        .string()
        .regex(/^mongodb(?:\+srv)?:\/\//, "Use a MongoDB connection URI"),
      JWT_SECRET: z
        .string()
        .min(32, "JWT_SECRET must contain at least 32 characters"),
      PORT: z.coerce.number().int().min(1).max(65535).default(4000),
      CLIENT_ORIGIN: z.url().default("http://127.0.0.1:5173"),
    })
    .safeParse(env);
  if (!result.success) {
    // Report field names/messages, never the values of secrets or connection strings.
    throw new Error(
      `Configuration error: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  return {
    mongoUri: result.data.MONGO_URI,
    jwtSecret: result.data.JWT_SECRET,
    port: result.data.PORT,
    clientOrigin: result.data.CLIENT_ORIGIN,
  };
}
