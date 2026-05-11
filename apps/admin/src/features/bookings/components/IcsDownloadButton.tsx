import { Button } from "@/components/ui/button";

type Props = { bookingId: string };

export function IcsDownloadButton({ bookingId }: Props) {
  return (
    <Button asChild variant="outline">
      <a href={`/my-bookings/${bookingId}/ics`} download>
        Add to calendar (.ics)
      </a>
    </Button>
  );
}
