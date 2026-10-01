import os from "node:os";
import { logger } from "./lib/logger.js";

const [{ env }, { createApp }, { prisma }] = await Promise.all([
  import("./config/env.js"),
  import("./app.js"),
  import("./lib/prisma.js")
]);

const app = createApp();

import("./services/badgeService.js").then(({ seedBadges }) => {
  seedBadges()
    .then(() => logger.info("[startup] Badges seeded successfully"))
    .catch(err => logger.error({ err }, "[startup] Failed to seed badges"));
});

import("./controllers/sessionController.js").then(({ sweepStuckSessions }) => {
  sweepStuckSessions()
    .then((count) => {
      if (count) logger.info({ count }, "[startup] Stuck sessions finalized");
    })
    .catch(err => logger.error({ err }, "[startup] Failed to sweep stuck sessions"));
  setInterval(() => {
    sweepStuckSessions().catch(err => logger.error({ err }, "[sweep] Failed to sweep stuck sessions"));
  }, 60_000);
});

function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((address): address is os.NetworkInterfaceInfo => {
      return Boolean(
        address &&
          address.family === "IPv4" &&
          !address.internal
      );
    })
    .map((address) => address.address);
}

const server = app.listen(parseInt(env.PORT, 10), "0.0.0.0", () => {
  logger.info(`Sales AI Coach API running on http://127.0.0.1:${env.PORT}`);
  for (const address of getLanAddresses()) {
    logger.info(`LAN API available at http://${address}:${env.PORT}`);
  }
});

const shutdown = async () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
