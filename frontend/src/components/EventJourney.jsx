const STAGES = [
  { key: "registered", label: "Registered" },
  { key: "checked-in", label: "Checked in" },
  { key: "gallery-ready", label: "Gallery" },
];

const ORDER = { registered: 0, "checked-in": 1, "gallery-ready": 2 };

/**
 * Shows how far a guest has progressed, so they can see which stage they are
 * waiting on rather than just whether a button is available.
 */
export default function EventJourney({ stage = "registered" }) {
  const current = ORDER[stage] ?? 0;

  return (
    <div>
      <div className="stepper" role="list">
        {STAGES.map((s, i) => {
          const state = i < current ? "is-done" : i === current ? "is-current" : "";
          return (
            <div key={s.key} className={`step ${state}`} role="listitem" style={{ paddingRight: i < STAGES.length - 1 ? 6 : 0 }}>
              <div className="step-bar" />
              <span className="step-label">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const stageMessage = (item) => {
  if (item.stage === "gallery-ready") return "Your gallery is unlocked.";
  if (item.stage === "checked-in") {
    return "You are checked in. Photos appear here once the team uploads them.";
  }
  if (item.hasEnded) return "This event has ended and you were not checked in.";
  if (item.event?.isPremium && item.paymentStatus === "pending") {
    return "Awaiting payment confirmation. Bring your QR code once payment is confirmed - check-in opens after that.";
  }
  return "Bring your QR code to the event so staff can check you in.";
};
