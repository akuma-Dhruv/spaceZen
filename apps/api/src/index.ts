import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { env } from "./config/env";

const port = env.PORT;

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
