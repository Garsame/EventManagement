import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client.js";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
import Alert from "../components/ui/Alert.jsx";
import Loading from "../components/ui/Loading.jsx";
import SectionLayout, { useEventBase } from "../components/layout/SectionLayout.jsx";
import QrCode from "../components/QrCode.jsx";
import EventJourney from "../components/EventJourney.jsx";

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function RegistrationStatusPage() {
  const { eventId } = useParams();
  const base = useEventBase();
  const [registration, setRegistration] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await client.get(`/api/events/${eventId}/registration/me`);
        setRegistration(res.data.registration);
      } catch (err) {
        setError(err.response?.data?.error?.message || "Not registered");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  const status = registration?.approvalStatus || "pending";
  const attended = registration?.attended;
  const approved = status === "approved";

  const stage = attended ? "checked-in" : approved ? "approved" : "requested";

  const subtitle = approved
    ? "Show this QR code at the door to check in"
    : status === "rejected"
      ? "This registration was not approved"
      : "Waiting for the organiser to approve your place";

  return (
    <SectionLayout title="Registration Status" subtitle={subtitle}>
      <>
        {loading && <Loading />}
        {error && <Alert variant="error">{error}</Alert>}

        {registration && (
          <Card style={{ maxWidth: 560 }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="text-muted text-sm">Your status</div>
                <h2 className="m-0 text-xl">
                  {attended ? "Checked in"
                    : status === "approved" ? "Approved"
                    : status === "rejected" ? "Not approved"
                    : "Awaiting approval"}
                </h2>
              </div>
              <Badge variant={attended || approved ? "success" : status === "rejected" ? "danger" : "warn"}>
                {attended ? "Checked in" : status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending"}
              </Badge>
            </div>

            {status !== "rejected" && (
              <div className="my-5">
                <EventJourney stage={stage} />
              </div>
            )}

            {/* Approved: the code and QR exist and are shown. */}
            {approved && (
              <>
                <div className="card-muted !p-4 text-center mb-4">
                  <div className="text-muted text-sm">Registration code</div>
                  <h2 className="m-0 mt-1 tracking-[0.16em]">{registration.registrationCode}</h2>
                </div>

                <div style={{ display: "grid", placeItems: "center", gap: "0.75rem", margin: "1.25rem 0" }}>
                  <QrCode value={registration.qrToken} size={220} />
                  <p className="text-muted" style={{ margin: 0, textAlign: "center", maxWidth: 360 }}>
                    {attended
                      ? "You are already checked in. Your gallery is unlocked."
                      : "Staff will scan this at the event. It works once — after check-in it cannot be used again."}
                  </p>
                </div>
              </>
            )}

            {/* Pending: nothing to show yet, and we say so plainly. */}
            {status === "pending" && (
              <Alert variant="warn">
                The organiser is reviewing your registration. Once approved you will get an email
                with your QR code and registration code, and they will appear on this page.
              </Alert>
            )}

            {/* Rejected: scoped to this event, and the account is untouched. */}
            {status === "rejected" && (
              <>
                <Alert variant="error">
                  Your place at this event was not confirmed.
                  {registration.decisionNote ? ` “${registration.decisionNote}”` : ""}
                </Alert>
                <p className="text-muted mt-3">
                  This applies to this event only. Your account and details are unchanged, and you
                  can register for any other event.
                </p>
              </>
            )}

            {registration.checkedInAt && (
              <p className="text-muted">Checked in at {formatDate(registration.checkedInAt)}</p>
            )}

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
              <Link to={`${base}/${eventId}`} className="btn btn-ghost">Back to event</Link>
              {status === "rejected" && <Link to="/events" className="btn btn-primary">Browse other events</Link>}
              {attended && (
                <Link to={`${base}/${eventId}/gallery`} className="btn btn-primary">View gallery</Link>
              )}
            </div>
          </Card>
        )}
      </>
    </SectionLayout>
  );
}
