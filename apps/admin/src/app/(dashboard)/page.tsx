import { redirect } from "next/navigation";
import { getCachedSession } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardHome() {
  const session = await getCachedSession();
  if (!session) {
    redirect("/login");
  }
  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-semibold text-2xl md:text-3xl">
        Hello, {session.user.email}
      </h1>
      <p className="text-[var(--muted-foreground)]">
        You're signed in. Quote, gig, and freelancer surfaces land in later
        iterations.
      </p>
      <SignOutButton />
    </section>
  );
}
