import Link from "next/link";
import { redirect } from "next/navigation";
import { NoPermissionCard } from "@/components/NoPermissionCard";
import { CreateServiceDialog } from "@/features/services/components/ServiceDialog";
import { ServicesTable } from "@/features/services/components/ServicesTable";
import { listServices } from "@/features/services/server/queries";
import { getCachedSession } from "@/lib/auth";
import { assertPermission, userHasPermission } from "@/lib/permissions";

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const session = await getCachedSession();
  if (!session) redirect("/login");

  const allowed = await userHasPermission("SERVICE_CREATE");
  if (!allowed) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="font-semibold text-2xl md:text-3xl">Services</h1>
        <NoPermissionCard />
      </section>
    );
  }

  // Defense in depth: even though `userHasPermission` already gated the UI,
  // assert here so any future refactor that bypasses the gate still 403s.
  await assertPermission("SERVICE_CREATE");

  const params = await searchParams;
  const includeArchived = params.archived === "1";
  const services = await listServices({ includeArchived });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-semibold text-2xl md:text-3xl">Services</h1>
          <p className="text-[var(--muted-foreground)] text-sm">
            The catalog of offerings the squad bills against. Archive to retire
            a service without affecting historical events.
          </p>
        </div>
        <CreateServiceDialog />
      </header>
      <div className="flex items-center justify-end">
        <Link
          href={includeArchived ? "/services" : "/services?archived=1"}
          className="text-sm underline-offset-4 hover:underline"
        >
          {includeArchived ? "Hide archived" : "Show archived"}
        </Link>
      </div>
      <ServicesTable services={services} />
    </section>
  );
}
