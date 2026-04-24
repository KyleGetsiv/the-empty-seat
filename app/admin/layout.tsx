import { ReactNode } from "react";

// Outer admin layout — no auth check here.
// /admin/login must be publicly accessible so unauthenticated users can log in.
// Auth gate lives in app/admin/(protected)/layout.tsx, which wraps everything
// except the login page.
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
