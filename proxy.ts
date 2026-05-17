import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";

const privateRoutes = ["/", "/lists", "/watchlist", "/favorites", "/friends", "/profile"];
const authRoutes = ["/login", "/register"];

function isPrivateRoute(path: string): boolean {
  return privateRoutes.some(route => path === route || path.startsWith(route + "/"));
}

export default async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const session = request.cookies.get("session")?.value;
  const payload = await decrypt(session);

  if (isPrivateRoute(path) && !payload) {
    return NextResponse.redirect(new URL("/discover", request.nextUrl));
  }

  if (authRoutes.includes(path) && payload) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$|favicon.ico).*)"],
};
