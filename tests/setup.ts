import path from "node:path";
import dotenv from "dotenv";

// Same local Supabase credentials the app itself reads from .env.local
// (see CLAUDE.md's "Local backend" section) — integration tests talk to
// the real local Postgres/Auth stack, the same one `npm run dev` uses.
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
