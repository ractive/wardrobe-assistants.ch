import type * as React from "react";
import type { EventAssignedParams } from "./event-assigned";
import EventAssigned from "./event-assigned";
import type { EventBroadcastParams } from "./event-broadcast";
import EventBroadcast from "./event-broadcast";
import type { ParticipationRequestedParams } from "./participation-requested";
import ParticipationRequested from "./participation-requested";
import type { PasswordResetParams } from "./password-reset";
import PasswordReset from "./password-reset";
import type { UserDirectMessageParams } from "./user-direct-message";
import UserDirectMessage from "./user-direct-message";
import type { VerifyEmailParams } from "./verify-email";
import VerifyEmail from "./verify-email";

type TemplateEntry<P> = {
  component: (p: P) => React.ReactElement;
  subject: (p: P) => string;
};

export const templates = {
  eventAssigned: {
    component: EventAssigned,
    subject: (p: EventAssignedParams) => `Assigned to event: ${p.eventName}`,
  } satisfies TemplateEntry<EventAssignedParams>,

  eventBroadcast: {
    component: EventBroadcast,
    subject: (p: EventBroadcastParams) => p.subject,
  } satisfies TemplateEntry<EventBroadcastParams>,

  participationRequested: {
    component: ParticipationRequested,
    subject: (p: ParticipationRequestedParams) =>
      `Participation request: ${p.eventName}`,
  } satisfies TemplateEntry<ParticipationRequestedParams>,

  passwordReset: {
    component: PasswordReset,
    subject: () => "Reset your Wardrobe Assistants admin password",
  } satisfies TemplateEntry<PasswordResetParams>,

  verifyEmail: {
    component: VerifyEmail,
    subject: () => "Verify your Wardrobe Assistants admin email",
  } satisfies TemplateEntry<VerifyEmailParams>,

  userDirectMessage: {
    component: UserDirectMessage,
    subject: (p: UserDirectMessageParams) => p.subject,
  } satisfies TemplateEntry<UserDirectMessageParams>,
} as const;

export type TemplateKey = keyof typeof templates;

// Infer the params type from the component prop type for a given key.
export type ParamsFor<K extends TemplateKey> = Parameters<
  (typeof templates)[K]["component"]
>[0];

// Re-export param types for use outside the template directory.
export type {
  EventAssignedParams,
  EventBroadcastParams,
  ParticipationRequestedParams,
  PasswordResetParams,
  UserDirectMessageParams,
  VerifyEmailParams,
};
