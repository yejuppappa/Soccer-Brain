import type { Express } from "express";
import type { Server } from "http";

import adminSync from "./admin/sync";
import adminLeagues from "./admin/leagues";
import adminInjuries from "./admin/injuries";
import adminOdds from "./admin/odds";
import adminDebug from "./admin/debug";
import publicRoutes from "./public";

// BigInt를 res.json / JSON.stringify에서 에러 안 나게 처리
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Admin API
  app.use("/api/admin", adminSync);
  app.use("/api/admin", adminLeagues);
  app.use("/api/admin", adminInjuries);
  app.use("/api/admin", adminOdds);
  app.use("/api/admin", adminDebug);

  // Public API
  app.use("/api", publicRoutes);

  // V2 프론트엔드용 API
  const { registerV2Routes } = await import("../routes-v2");
  registerV2Routes(app);

  return httpServer;
}
