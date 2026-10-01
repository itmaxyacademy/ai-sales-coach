import { ShieldAlert } from "lucide-react";
import type { Role } from "../../store/authStore";

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Array<Exclude<Role, null>>;
  userRole: Role;
}

export function RoleGuard({ children, allowedRoles, userRole }: RoleGuardProps) {
  if (!userRole) {
    return null; // Let the layout/page handle redirect
  }

  if (!allowedRoles.includes(userRole)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <ShieldAlert className="w-16 h-16 text-[var(--color-danger)] mb-4" />
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-[var(--color-text-muted)] max-w-md">
          You do not have the required permissions to view this page. If you believe this is an error, please contact your system administrator.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
