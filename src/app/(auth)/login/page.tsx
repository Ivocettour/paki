import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Ingresar",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { callbackUrl } = await searchParams;

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center bg-surface-subtle px-6 py-12">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-10">
          <h1 className="text-display text-fg">Acceso del personal</h1>
          <p className="mt-3 text-[17px] text-fg-secondary">
            Para vendedores y administradores.
          </p>
        </div>

        <div className="bg-surface-raised rounded-[18px] shadow-[var(--shadow-card)] p-8">
          <LoginForm callbackUrl={callbackUrl} />
        </div>

        <p className="mt-8 text-center text-[13px] text-fg-tertiary">
          Acceso exclusivo para personal autorizado.{" "}
          <Link href="/tienda" className="text-accent hover:underline">
            Volver a la tienda
          </Link>
        </p>
      </div>
    </main>
  );
}
