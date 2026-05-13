// iter-42 §C: Bell badge data endpoint.
//
// Returns the list of "needs attention" bookings for the current session user.
// The client component polls this every 60 s and on window focus.
//
// Auth: requires a valid Better Auth session cookie. Unauthenticated requests
// get 401. Role-branching (admin vs squad) is done here by reading user_profile
// via roleForUserId, matching the pattern used throughout the dashboard layout.
import { listBellItems } from "@/features/bookings/server/queries";
import { getCachedSession, roleForUserId } from "@/lib/auth";

// Per-user response — never cache at the edge or in the Next data cache.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const session = await getCachedSession();
  if (!session) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const role = await roleForUserId(session.user.id);
  if (role !== "ADMIN" && role !== "SQUAD_MEMBER") {
    // No user_profile yet — treat as empty rather than erroring.
    return Response.json({ items: [] });
  }

  try {
    const items = await listBellItems(session.user.id, role);
    // Serialise dates as ISO strings for the client.
    return Response.json({
      items: items.map((i) => ({ ...i, date: i.date.toISOString() })),
    });
  } catch (err) {
    // iter-42 §B: surface bell errors in `bunny logs` instead of swallowing.
    // onRequestError won't see this because we caught it here.
    console.error("bell: failed to list items", err);
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
