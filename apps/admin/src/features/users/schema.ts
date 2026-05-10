// `/min` ships a smaller metadata bundle (covers parsing/validation but not
// formatting), keeping the admin client bundle lean since this schema is
// imported by the InviteUserForm client component.
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { z } from "zod";

// Inlined to avoid a transitive import of @/lib/permissions, which loads
// @/lib/auth → @/lib/db → @/lib/env at module init. The catalog itself lives
// in @/lib/permissions.ts; this is just the role enum.
const ROLES = ["ADMIN", "SQUAD_MEMBER"] as const;

export const inviteUserInput = z.object({
  email: z.string().email().max(254),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  nickname: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  mobileNumber: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(
      z
        .string()
        .optional()
        .transform((v, ctx) => {
          if (v === undefined) return undefined;
          const parsed = parsePhoneNumberFromString(v, "CH");
          if (!parsed?.isValid()) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message:
                "Must be a valid phone number (E.164 or local Swiss format)",
            });
            return z.NEVER;
          }
          return parsed.number;
        }),
    ),
  role: z.enum(ROLES),
});
export type InviteUserInput = z.infer<typeof inviteUserInput>;

export const messageUserInput = z.object({
  userId: z.string().min(1),
  // CR/LF stripped to neutralize email-header injection (audit C-SEC-07):
  // the subject is the only field that lands in raw SMTP headers; body is
  // base64/quoted-printable encoded by the transport. Strip rather than
  // refuse so a stray paste doesn't surface as a generic "invalid input".
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .max(200)
    .transform((s) => s.replace(/[\r\n]+/g, " ")),
  body: z.string().trim().min(1, "Message body is required").max(10_000),
});
export type MessageUserInput = z.infer<typeof messageUserInput>;

export const deleteUserInput = z.object({
  userId: z.string().min(1),
});
export type DeleteUserInput = z.infer<typeof deleteUserInput>;

export const userListItem = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(ROLES),
  status: z.enum(["invited", "verified"]),
  createdAt: z.date(),
});
export type UserListItem = z.infer<typeof userListItem>;

export const userDetail = userListItem.extend({
  firstName: z.string(),
  lastName: z.string(),
  nickname: z.string().nullable(),
  mobileNumber: z.string().nullable(),
  invitedAt: z.date(),
  verifiedAt: z.date().nullable(),
});
export type UserDetail = z.infer<typeof userDetail>;

export const actionResult = z.discriminatedUnion("error", [
  z.object({ error: z.literal(false), message: z.string() }),
  z.object({ error: z.literal(true), message: z.string() }),
]);
export type ActionResult = z.infer<typeof actionResult>;
