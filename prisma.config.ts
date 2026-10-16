import "dotenv/config";

import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

export default definePrismaConfig({
  orm: ormConfig({
    contract: "./prisma/schema.prisma",
    output: "./prisma",
    db: { connection: process.env["DATABASE_URL"]! },
    migrations: { dir: "./prisma/migrations" },
  }),
  skills: {
    agents: ["claude", "cursor", "agents", "devin"],
  },
});
