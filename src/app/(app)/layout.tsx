import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { getCurrentUser } from "@/lib/auth/session";
import { navigationFor } from "@/lib/navigation";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // Segunda barrera, además del proxy: el layout nunca renderiza sin sesión.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <SessionProvider>
      <AppShell
        sections={navigationFor(user.role)}
        user={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        }}
      >
        {children}
      </AppShell>
    </SessionProvider>
  );
}
