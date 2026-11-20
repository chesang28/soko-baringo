import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { signIn } from "./actions";

export const metadata = { title: "Agent login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Agent login</h1>
      <ActionForm action={signIn} resetOnSuccess={false} className="card mt-4 space-y-3">
        <input type="hidden" name="next" value={next ?? "/admin"} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <SubmitButton className="btn w-full">Sign in</SubmitButton>
      </ActionForm>
    </div>
  );
}
