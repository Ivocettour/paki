/// URL pública de la aplicación, sin barra final. Se usa en los avisos para armar
/// enlaces directos a cada consulta.
export function appUrl(): string {
  const raw =
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
}
