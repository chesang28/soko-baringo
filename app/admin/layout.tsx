import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export const metadata = { title: "Agent dashboard", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p>Your account ({user.email}) is not an agent account yet.</p>
        <form action={signOut} className="mt-4"><button className="btn-ghost">Sign out</button></form>
      </div>
    );
  }

  const links = [["/admin", "Overview"], ["/admin/farmers", "Farmers"], ["/admin/listings", "Listings"], ["/admin/orders", "Orders"]];
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b pb-3">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-brand-50">{label}</Link>
        ))}
        <form action={signOut} className="ml-auto"><button className="btn-ghost">Sign out</button></form>
      </div>
      {children}
    </div>
  );
}
