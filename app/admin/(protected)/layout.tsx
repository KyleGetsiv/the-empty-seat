import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const navItems = [
  { label: "Dashboard", href: "/admin" },
  { label: "Milestones", href: "/admin/milestones" },
  { label: "Cities", href: "/admin/cities" },
  { label: "Disclosed Metrics", href: "/admin/disclosed-metrics" },
  { label: "Fleet Snapshots", href: "/admin/fleet-snapshots" },
  { label: "Ride Estimates", href: "/admin/ride-estimates" },
  { label: "Financial Periods", href: "/admin/financial-periods" },
  { label: "Sources", href: "/admin/sources" },
  { label: "Companies", href: "/admin/companies" },
  { label: "Site Content", href: "/admin/site-content" },
];

async function SignOutButton() {
  async function signOut() {
    "use server";
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/admin/login");
  }

  return (
    <form action={signOut}>
      <button
        type="submit"
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Sign out
      </button>
    </form>
  );
}

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-52 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-5 border-b border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            The Empty Seat
          </p>
          <p className="text-sm font-medium text-gray-800 mt-0.5">Admin</p>
        </div>
        <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-gray-200">
          <p className="text-xs text-gray-400 mb-2 truncate">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-8">{children}</main>
    </div>
  );
}
