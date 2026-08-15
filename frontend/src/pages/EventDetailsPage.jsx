import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import Alert from "../components/ui/Alert.jsx";
import Badge from "../components/ui/Badge.jsx";
import Loading from "../components/ui/Loading.jsx";
import SectionLayout, { useEventBase } from "../components/layout/SectionLayout.jsx";

const formatDate = (value) => new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function EventDetailsPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthed, isStaff, profileComplete } = useAuth();
  const base = useEventBase();
  const [event, setEvent] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regLoading, setRegLoading] = useState(false);
  const [error, setError] = useState("");
  const [regError, setRegError] = useState("");
  const [profileBlocked, setProfileBlocked] = useState(false);
  const canManageMedia = isAuthed && isStaff;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await client.get(`/api/events/${eventId}`);
        setEvent(res.data);
      } catch (err) {
        setError(err.response?.data?.error?.message || "Failed to load event");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventId]);

  useEffect(() => {
    const loadRegistration = async () => {
      if (!isAuthed) return;
      try {
        const res = await client.get(`/api/events/${eventId}/registration/me`);
        setRegistration(res.data.registration);
      } catch (err) {
        // ignore 404 not registered
      }
    };
    loadRegistration();
  }, [eventId, isAuthed]);

  const handleRegister = async () => {
    if (!isAuthed) {
      navigate("/login");
      return;
    }
    setRegLoading(true);
    setRegError("");
    setProfileBlocked(false);
    try {
      const res = await client.post(`/api/events/${eventId}/register`);
      setRegistration(res.data.registration);
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === "PROFILE_INCOMPLETE") setProfileBlocked(true);
      setRegError(err.response?.data?.error?.message || "Registration failed");
    } finally {
      setRegLoading(false);
    }
  };

  // Known before submitting, so the guest is told up front rather than after
  // a failed attempt.
  const blockedByProfile = isAuthed && !profileComplete;

  return (
    <SectionLayout
      title={event?.title || "Event Details"}
      subtitle={event ? `${formatDate(event.startDateTime)} · ${event.location || "TBA"}` : "Loading"}
      actions={
        registration && (
          <Badge variant={registration.attended ? "success" : "warn"}>
            {registration.attended ? "Checked-in" : "Registered"}
          </Badge>
        )
      }
    >
      <>
        {loading && <Loading />}
        {error && <Alert variant="error">{error}</Alert>}

        {!loading && event && (
          <div className="grid" style={{ gap: "1.25rem" }}>
            <Card>
              <h2 style={{ marginTop: 0 }}>{event.title}</h2>
              <p className="text-muted">{event.description || "No description yet."}</p>
              <div className="two-col" style={{ marginTop: "1rem" }}>
                <div className="card-muted">
                  <strong>When</strong>
                  <div>{formatDate(event.startDateTime)}</div>
                  <div>{formatDate(event.endDateTime)}</div>
                </div>
                <div className="card-muted">
                  <strong>Location</strong>
                  <div>{event.location || "To be announced"}</div>
                </div>
              </div>
              <div className="card-muted" style={{ marginTop: "1rem" }}>
                Gallery unlocks after you are checked-in by the event team.
              </div>

              {blockedByProfile && !registration && (
                <Alert variant="warn" style={{ marginTop: "1rem" }}>
                  Complete your profile before registering.{" "}
                  {user?.missingProfileFields?.length > 0 && (
                    <>Still needed: <strong>{user.missingProfileFields.join(", ")}</strong>. </>
                  )}
                  <Link to="/dashboard/profile" className="underline font-bold">
                    Go to profile
                  </Link>
                </Alert>
              )}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
                {!registration && (
                  <Button onClick={handleRegister} disabled={regLoading || blockedByProfile}>
                    {regLoading ? "Registering..." : "Register for this event"}
                  </Button>
                )}
                {registration && (
                  <Card className="card-muted" style={{ flex: "1 1 260px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div className="text-muted">Registration code</div>
                        <strong>{registration.registrationCode}</strong>
                      </div>
                      <Button variant="ghost" onClick={() => navigator.clipboard.writeText(registration.registrationCode)}>
                        Copy
                      </Button>
                    </div>
                    <div className="text-muted" style={{ marginTop: "0.5rem" }}>
                      Attended: {registration.attended ? "Yes" : "No"}
                    </div>
                  </Card>
                )}
                <Button variant="secondary" onClick={() => navigate(`${base}/${eventId}/gallery`)}>
                  View Gallery
                </Button>
                <Button variant="ghost" onClick={() => navigate(`${base}/${eventId}/registration`)}>
                  View Registration Status
                </Button>
                {canManageMedia && (
                  <Button variant="ghost" onClick={() => navigate(`/events/${eventId}/media/manage`)}>
                    Manage Media
                  </Button>
                )}
              </div>
              {regError && !profileBlocked && (
                <Alert variant="error" style={{ marginTop: "0.75rem" }}>{regError}</Alert>
              )}
            </Card>
          </div>
        )}
      </>
    </SectionLayout>
  );
}
