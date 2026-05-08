import "server-only";
import { user, userProfile } from "@wardrobe-assistants/db/schema";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { type UserDetail, userDetail, userListItem } from "../schema";

function buildDisplayName(input: {
  firstName: string;
  lastName: string;
  nickname: string | null;
}): string {
  const trimmedNickname = input.nickname?.trim();
  if (trimmedNickname) return trimmedNickname;
  return `${input.firstName} ${input.lastName}`.trim();
}

export async function listUsers() {
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      nickname: userProfile.nickname,
      role: userProfile.role,
      status: userProfile.status,
    })
    .from(user)
    .innerJoin(userProfile, eq(userProfile.userId, user.id))
    .orderBy(desc(user.createdAt));

  return rows.map((r) =>
    userListItem.parse({
      id: r.id,
      email: r.email,
      displayName: buildDisplayName({
        firstName: r.firstName,
        lastName: r.lastName,
        nickname: r.nickname,
      }),
      role: r.role,
      status: r.status,
      createdAt: r.createdAt,
    }),
  );
}

export async function getUserById(id: string): Promise<UserDetail | null> {
  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      firstName: userProfile.firstName,
      lastName: userProfile.lastName,
      nickname: userProfile.nickname,
      mobileNumber: userProfile.mobileNumber,
      role: userProfile.role,
      status: userProfile.status,
      invitedAt: userProfile.invitedAt,
      verifiedAt: userProfile.verifiedAt,
    })
    .from(user)
    .innerJoin(userProfile, eq(userProfile.userId, user.id))
    .where(eq(user.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return userDetail.parse({
    id: row.id,
    email: row.email,
    displayName: buildDisplayName({
      firstName: row.firstName,
      lastName: row.lastName,
      nickname: row.nickname,
    }),
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    firstName: row.firstName,
    lastName: row.lastName,
    nickname: row.nickname,
    mobileNumber: row.mobileNumber,
    invitedAt: row.invitedAt,
    verifiedAt: row.verifiedAt,
  });
}
