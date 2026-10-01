"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, getDashboardPath } from "../store/authStore";

export default function Home() {
  const router = useRouter();
  const { user, token, _hasHydrated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !_hasHydrated) return;
    
    if (!token || !user) {
      router.push("/login");
      return;
    }

    router.push(getDashboardPath(user.role));
  }, [user, token, router, mounted, _hasHydrated]);

  if (!mounted) return null;

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-accent)]"></div>
    </div>
  );
}
