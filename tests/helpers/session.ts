import type { UserRole } from "@prisma/client";
import type { SessionUser } from "@/lib/auth/session";

/// Sesión activa simulada para los tests de servicios.
/// Los `vi.mock` viven en cada archivo de test, porque Vitest los eleva al
/// tope del módulo donde se declaran.
let currentUser: SessionUser | null = null;

export function actAs(user: { id: string; role: UserRole }): void {
  currentUser = {
    id: user.id,
    email: "test@test.com",
    firstName: "Test",
    lastName: "User",
    fullName: "Test User",
    role: user.role,
    status: "ACTIVO",
  };
}

export function actAsNobody(): void {
  currentUser = null;
}

export function getMockedUser(): SessionUser | null {
  return currentUser;
}
