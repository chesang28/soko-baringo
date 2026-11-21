import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";

export const metadata = { title: "Agent dashboard", robots: { index: false } };

const LINKS: [string, string][] = [
  ["/admin", "Overview"], ["/admin/orders", "Orders"], ["/admin/needs", "Buyer requests"], ["/admin/listings", "Listings"],
  ["/admin/farmers", "Farmers"], ["/admin/customers", "Customers"], ["/admin/money", "Money"], ["/admin/agents", "Agents"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");

  if (!isAdmin) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p>Your account ({user.email}) is not an active agent account.</p>
        <form action={signOut} className="mt-4"><button className="btn-ghost">Sign out</button></form>
      </div>
    );
  }

  return (
    <div>
      <div className="-mx-4 mb-6 flex items-center gap-1 overflow-x-auto border-b px-4 pb-3 print:hidden">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-brand-50">{label}</Link>
        ))}
        <form action={signOut} className="ml-auto pl-2"><button className="btn-ghost whitespace-nowrap">Sign out</button></form>
      </div>
      {children}
    </div>
  );
}
