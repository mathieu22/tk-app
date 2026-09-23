import { NextResponse, type NextRequest } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/session-jwt";

const PUBLIC = ["/connexion"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value);

  if (!isPublic && !session) return NextResponse.redirect(new URL("/connexion", req.nextUrl));
  if (isPublic && session) return NextResponse.redirect(new URL("/presence", req.nextUrl));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
