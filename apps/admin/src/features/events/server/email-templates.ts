import { format } from "date-fns";

interface AssignmentEmailInput {
  eventName: string;
  date: Date;
  venue: string;
  notes: string | null | undefined;
}

export function assignmentEmail(input: AssignmentEmailInput): {
  subject: string;
  text: string;
} {
  const dateStr = format(input.date, "EEEE, d MMMM yyyy");
  const lines = [
    `You've been assigned to "${input.eventName}".`,
    "",
    `When:  ${dateStr}`,
    `Where: ${input.venue}`,
  ];
  if (input.notes) {
    lines.push("", "Notes:", input.notes);
  }
  return {
    subject: `Assigned to event: ${input.eventName}`,
    text: lines.join("\n"),
  };
}
