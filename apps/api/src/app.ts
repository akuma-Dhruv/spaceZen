import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { env } from "./config/env";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

if (env.CLERK_PROXY_ENABLED) {
  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
}

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

if (env.NODE_ENV === "production") {
  const staticDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../dist/public",
  );

  app.use(express.static(staticDir));
  app.get("/*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(staticDir, "index.html"));
  });
}

export default app;
