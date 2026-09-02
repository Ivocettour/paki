import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = ["/login"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = Boolean(req.auth?.user) && req.auth?.user?.status === "ACTIVO";
  const isPublicRoute = PUBLIC_ROUTES.some((route) => nextUrl.pathname.startsWith(route));

  /*
   * El login siempre es accesible.
   *
   * Acá solo se ve el JWT, que puede estar desactualizado: si al usuario lo
   * desactivaron o lo borraron, el token sigue diciendo que hay sesión válida.
   * Si desde este punto se redirigiera al inicio, se armaría un bucle con el
   * layout, que sí consulta la base y devuelve al login.
   *
   * Quien decide es la página de login: comprueba la sesión contra la base y
   * redirige al inicio solo cuando es realmente válida.
   */
  if (isPublicRoute) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl);
    // Se preserva el destino para volver ahí después de iniciar sesión.
    if (nextUrl.pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Se excluyen assets estáticos y la propia API de autenticación.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
