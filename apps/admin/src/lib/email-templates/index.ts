import type * as React from "react";
import type { AssignmentConfirmedParams } from "./assignment-confirmed";
import AssignmentConfirmed from "./assignment-confirmed";
import type { AssignmentDeclinedParams } from "./assignment-declined";
import AssignmentDeclined from "./assignment-declined";
import type { AssignmentInviteParams } from "./assignment-invite";
import AssignmentInvite from "./assignment-invite";
import type { AssignmentWithdrawnParams } from "./assignment-withdrawn";
import AssignmentWithdrawn from "./assignment-withdrawn";
import type { BookingBroadcastParams } from "./booking-broadcast";
import BookingBroadcast from "./booking-broadcast";
import type { BookingCancelledParams } from "./booking-cancelled";
import BookingCancelled from "./booking-cancelled";
import type { BookingRejectedParams } from "./booking-rejected";
import BookingRejected from "./booking-rejected";
import type { BookingRequestReceivedParams } from "./booking-request-received";
import BookingRequestReceived from "./booking-request-received";
import type { BookingRequestedParams } from "./booking-requested";
import BookingRequested from "./booking-requested";
import type { OfferAcceptedParams } from "./offer-accepted";
import OfferAccepted from "./offer-accepted";
import type { OfferAcceptedAdminParams } from "./offer-accepted-admin";
import OfferAcceptedAdmin from "./offer-accepted-admin";
import type { OfferRejectedParams } from "./offer-rejected";
import OfferRejected from "./offer-rejected";
import type { OfferRevisedParams } from "./offer-revised";
import OfferRevised from "./offer-revised";
import type { OfferSentParams } from "./offer-sent";
import OfferSent from "./offer-sent";
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
  assignmentConfirmed: {
    component: AssignmentConfirmed,
    subject: (p: AssignmentConfirmedParams) =>
      `Assignment confirmed: ${p.bookingName}`,
  } satisfies TemplateEntry<AssignmentConfirmedParams>,

  assignmentDeclined: {
    component: AssignmentDeclined,
    subject: (p: AssignmentDeclinedParams) =>
      `Assignment declined: ${p.bookingName}`,
  } satisfies TemplateEntry<AssignmentDeclinedParams>,

  assignmentInvite: {
    component: AssignmentInvite,
    subject: (p: AssignmentInviteParams) => `Please confirm: ${p.bookingName}`,
  } satisfies TemplateEntry<AssignmentInviteParams>,

  assignmentWithdrawn: {
    component: AssignmentWithdrawn,
    subject: (p: AssignmentWithdrawnParams) =>
      `Assignment withdrawn: ${p.bookingName}`,
  } satisfies TemplateEntry<AssignmentWithdrawnParams>,

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

  bookingRequested: {
    component: BookingRequested,
    subject: (p: BookingRequestedParams) =>
      `New booking request: ${p.customerName} — ${p.date}`,
  } satisfies TemplateEntry<BookingRequestedParams>,

  bookingRequestReceived: {
    component: BookingRequestReceived,
    subject: () => "We received your booking request",
  } satisfies TemplateEntry<BookingRequestReceivedParams>,

  offerAccepted: {
    component: OfferAccepted,
    subject: (p: OfferAcceptedParams) =>
      `Offer accepted: ${p.customerName} — ${p.date}`,
  } satisfies TemplateEntry<OfferAcceptedParams>,

  offerAcceptedAdmin: {
    component: OfferAcceptedAdmin,
    subject: (p: OfferAcceptedAdminParams) =>
      `Booking confirmed: ${p.bookingName}`,
  } satisfies TemplateEntry<OfferAcceptedAdminParams>,

  offerRejected: {
    component: OfferRejected,
    subject: (p: OfferRejectedParams) => `Offer declined: ${p.customerName}`,
  } satisfies TemplateEntry<OfferRejectedParams>,

  offerRevised: {
    component: OfferRevised,
    subject: () => "Your wardrobe offer has been updated",
  } satisfies TemplateEntry<OfferRevisedParams>,

  offerSent: {
    component: OfferSent,
    subject: () => "Your wardrobe offer is ready to review",
  } satisfies TemplateEntry<OfferSentParams>,

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
  AssignmentConfirmedParams,
  AssignmentDeclinedParams,
  AssignmentInviteParams,
  AssignmentWithdrawnParams,
  BookingBroadcastParams,
  BookingCancelledParams,
  BookingRejectedParams,
  BookingRequestedParams,
  BookingRequestReceivedParams,
  OfferAcceptedAdminParams,
  OfferAcceptedParams,
  OfferRejectedParams,
  OfferRevisedParams,
  OfferSentParams,
  ParticipationRequestedParams,
  PasswordResetParams,
  UserDirectMessageParams,
  VerifyEmailParams,
};
