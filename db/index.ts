// db/index.ts
// Drizzle client backed by the Neon serverless HTTP driver. Used by Better Auth on the server.
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { schema } from "@/db/schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and add your Neon connection string."
  );
}

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
