import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";

const { auth } = NextAuth(authConfig);

/// La tienda es pública: cualquiera puede ver los equipos sin iniciar sesión.
/// Las fotos de los equipos se muestran en la tienda: las ve cualquiera.
/// Los webhooks y el cron no tienen sesión de usuario: se autentican solos
/// (firma de Meta y CRON_SECRET), y exigirles login los dejaría sin funcionar.
const PUBLIC_ROUTES = ["/login", "/tienda", "/api/webhooks", "/api/cron", "/api/fotos"];

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
    // La tienda es la pantalla principal: quien llega al dominio sin sesión es
    // un cliente y ve la tienda en "/" (la URL no cambia). El personal entra
    // por el botón discreto "Acceso del personal" o directo en /login.
    if (nextUrl.pathname === "/") {
      return NextResponse.rewrite(new URL("/tienda", nextUrl));
    }

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
