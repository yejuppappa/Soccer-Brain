import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  migrations: {
    path: "prisma/migrations",
  },
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
