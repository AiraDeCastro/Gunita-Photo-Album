import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/sign-in"];

/**
 * Refreshes the Supabase session cookie on every matched request, and
 * redirects: signed-out users away from anything but /sign-in, and
 * signed-in users away from /sign-in itself.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Keep this call between createServerClient and returning the response —
  // it's what actually refreshes an expiring session token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  );

  if (!user && !isPublicRoute) {
    return redirectPreservingCookies(request, "/sign-in", supabaseResponse);
  }

  if (user && isPublicRoute) {
    return redirectPreservingCookies(request, "/", supabaseResponse);
  }

  return supabaseResponse;
}

function redirectPreservingCookies(
  request: NextRequest,
  pathname: string,
  responseWithRefreshedCookies: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirectResponse = NextResponse.redirect(url);
  responseWithRefreshedCookies.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}
