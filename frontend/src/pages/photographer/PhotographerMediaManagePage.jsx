import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { photographerClient } from "../../context/PhotographerAuthContext.jsx";
import PhotographerConsoleLayout from "../../components/layout/PhotographerConsoleLayout.jsx";
import MediaManager from "../../components/MediaManager.jsx";

export default function PhotographerMediaManagePage() {
  const { eventId } = useParams();
  const [title, setTitle] = useState("");

  useEffect(() => {
    photographerClient.get(`/api/events/${eventId}`).then((res) => setTitle(res.data.title)).catch(() => {});
  }, [eventId]);

  return (
    <PhotographerConsoleLayout title="Manage media" subtitle={title || "Loading event…"}>
      <MediaManager client={photographerClient} />
    </PhotographerConsoleLayout>
  );
}
