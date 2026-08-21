import { defineConfig } from "prisma/config";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: "file:./dev.db",
  },
  migrations: {
    adapter: async () => new PrismaBetterSQLite3({ url: "file:./dev.db" }),
  },
});