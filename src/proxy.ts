import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Excludes /api/* too: an API route should return a 401, not a
    // redirect to /sign-in, and letting middleware touch the body of a
    // large upload hits Next's ~10MB middleware body-read cap. Every
    // route under src/app/api/ does its own auth check instead.
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
