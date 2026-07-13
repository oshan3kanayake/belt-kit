"use client";

// Self-signup is disabled — staff accounts are created by owner/manager/front-desk
// from Users & Roles. This page just redirects to login.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignupDisabled() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}
