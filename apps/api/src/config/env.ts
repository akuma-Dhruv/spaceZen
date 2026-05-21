import { z } from "zod";

const envSchema = z.object({
  PORT: z.preprocess((value) => Number(value ?? 4000), z.number().int().positive()).default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  GEMINI_API_KEY: z.string().optional(),
  LOG_LEVEL: z.string().default("info"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  OBJECT_STORAGE_PROVIDER: z.enum(["local", "s3", "gcp"]).default("local"),
  PUBLIC_OBJECT_SEARCH_PATHS: z.string().default(""),
  PRIVATE_OBJECT_DIR: z.string().default(""),
  API_PUBLIC_URL: z.preprocess(
    (value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().url().optional(),
  ),
  CLERK_PROXY_ENABLED: z.coerce.boolean().default(false),
  CLERK_PROXY_PATH: z.string().default("/api/__clerk"),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SESSION_TOKEN: z.string().optional(),
  AWS_S3_ENDPOINT: z.preprocess(
    (value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().url().optional(),
  ),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
});

export const env = envSchema.parse(process.env);
