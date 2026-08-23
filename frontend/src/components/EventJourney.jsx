import Stepper from "./ui/Stepper.jsx";

const STAGES = [
  { key: "requested", label: "Requested" },
  { key: "approved", label: "Approved" },
  { key: "checked-in", label: "Checked in" },
  { key: "gallery-ready", label: "Gallery" },
];

const ORDER = { requested: 0, registered: 0, approved: 1, "checked-in": 2, "gallery-ready": 3 };

/**
 * Shows how far a guest has progressed, so they can see which stage they are
 * waiting on rather than just whether a button is available.
 *
 * A rejected registration has no position on this line - it left it - so the
 * caller renders its own message instead of a stepper.
 */
export default function EventJourney({ stage = "requested" }) {
  return <Stepper steps={STAGES} current={ORDER[stage] ?? 0} />;
}

export const stageMessage = (item) => {
  if (item.approvalStatus === "rejected") {
    return "Your registration was not approved for this event. You can register for any other event.";
  }
  if (item.stage === "gallery-ready") return "Your gallery is unlocked.";
  if (item.stage === "checked-in") {
    return "You are checked in. Photos appear here once the team uploads them.";
  }
  if (item.hasEnded) return "This event has ended and you were not checked in.";
  if (item.approvalStatus === "pending") {
    return "Waiting for the organiser to approve your place. Your QR code appears here once they do.";
  }
  if (item.event?.isPremium && item.paymentStatus === "pending") {
    return "Awaiting payment confirmation. Bring your QR code once payment is confirmed - check-in opens after that.";
  }
  return "Bring your QR code to the event so staff can check you in.";
};
