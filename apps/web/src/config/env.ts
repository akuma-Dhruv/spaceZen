import { z } from "zod";

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().default(""),
  VITE_BASE_PATH: z.preprocess(
    (value) => {
      if (typeof value !== "string") return "/";
      return value.trim() || "/";
    },
    z.string(),
  ).default("/"),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1, "VITE_CLERK_PUBLISHABLE_KEY is required"),
  VITE_APP_NAME: z.string().default("SpaceZen"),
  VITE_ENVIRONMENT: z.enum(["development", "production", "test"]).default(
    import.meta.env.PROD ? "production" : "development",
  ),
  VITE_CLERK_PROXY_URL: z.preprocess(
    (value) => {
      if (typeof value !== "string") return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().url().optional(),
  ),
});

export const env = envSchema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? "",
  VITE_BASE_PATH: import.meta.env.VITE_BASE_PATH ?? "/",
  VITE_CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME ?? "SpaceZen",
  VITE_ENVIRONMENT: import.meta.env.VITE_ENVIRONMENT ?? (import.meta.env.PROD ? "production" : "development"),
  VITE_CLERK_PROXY_URL: import.meta.env.VITE_CLERK_PROXY_URL,
});
