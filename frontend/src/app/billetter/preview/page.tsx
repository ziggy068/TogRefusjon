import TicketPreview from "@/components/TicketPreview";
import AuthGate from "@/components/AuthGate";

export default function TicketPreviewPage() {
  return (
    <AuthGate>
      <TicketPreview />
    </AuthGate>
  );
}
