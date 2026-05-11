import type * as React from "react";
import type { BookingAssignedParams } from "./booking-assigned";
import BookingAssigned from "./booking-assigned";
import type { BookingBroadcastParams } from "./booking-broadcast";
import BookingBroadcast from "./booking-broadcast";
import type { BookingCancelledParams } from "./booking-cancelled";
import BookingCancelled from "./booking-cancelled";
import type { BookingRejectedParams } from "./booking-rejected";
import BookingRejected from "./booking-rejected";
import type { OfferAcceptedAdminParams } from "./offer-accepted-admin";
import OfferAcceptedAdmin from "./offer-accepted-admin";
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
  bookingAssigned: {
    component: BookingAssigned,
    subject: (p: BookingAssignedParams) =>
      `Assigned to booking: ${p.bookingName}`,
  } satisfies TemplateEntry<BookingAssignedParams>,

  bookingBroadcast: {
    component: BookingBroadcast,
    subject: (p: BookingBroadcastParams) => p.subject,
  } satisfies TemplateEntry<BookingBroadcastParams>,

  bookingCancelled: {
    component: BookingCancelled,
    subject: (p: BookingCancelledParams) => `Cancelled: ${p.bookingName}`,
  } satisfies TemplateEntry<BookingCancelledParams>,

  bookingRejected: {
    component: BookingRejected,
    subject: (p: BookingRejectedParams) =>
      `About your booking request: ${p.bookingName}`,
  } satisfies TemplateEntry<BookingRejectedParams>,

  offerAcceptedAdmin: {
    component: OfferAcceptedAdmin,
    subject: (p: OfferAcceptedAdminParams) =>
      `Booking confirmed: ${p.bookingName}`,
  } satisfies TemplateEntry<OfferAcceptedAdminParams>,

  participationRequested: {
    component: ParticipationRequested,
    subject: (p: ParticipationRequestedParams) =>
      `Participation request: ${p.bookingName}`,
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
  BookingAssignedParams,
  BookingBroadcastParams,
  BookingCancelledParams,
  BookingRejectedParams,
  OfferAcceptedAdminParams,
  ParticipationRequestedParams,
  PasswordResetParams,
  UserDirectMessageParams,
  VerifyEmailParams,
};
