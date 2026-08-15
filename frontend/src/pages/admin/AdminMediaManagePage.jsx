import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { adminClient } from "../../context/AdminAuthContext.jsx";
import AdminConsoleLayout from "../../components/layout/AdminConsoleLayout.jsx";
import MediaManager from "../../components/MediaManager.jsx";

export default function AdminMediaManagePage() {
  const { eventId } = useParams();
  const [title, setTitle] = useState("");

  useEffect(() => {
    adminClient.get(`/api/events/${eventId}`).then((res) => setTitle(res.data.title)).catch(() => {});
  }, [eventId]);

  return (
    <AdminConsoleLayout title="Manage media" subtitle={title || "Loading event…"}>
      <MediaManager client={adminClient} />
    </AdminConsoleLayout>
  );
}
