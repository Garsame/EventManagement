import { Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout.jsx";
import PageHero from "../components/PageHero.jsx";
import Card from "../components/ui/Card.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import IconBadge from "../components/IconBadge.jsx";

const guestSteps = [
  {
    icon: "register",
    title: "Register for the event",
    desc: "Create a free account and RSVP to any public event in a few seconds — no app to install, no fees.",
  },
  {
    icon: "checkin",
    title: "Check in at the door",
    desc: "On arrival, the event team verifies you with your registration code or QR token. Takes seconds, no lines.",
  },
  {
    icon: "unlock",
    title: "Unlock your gallery",
    desc: "The moment you're checked in, every photo and video from the event unlocks — for you, and no one else.",
  },
];

const organizerPoints = [
  {
    icon: "publish",
    title: "Publish your event",
    desc: "Set the details, choose public or private visibility, and go live instantly for guests to find and register.",
  },
  {
    icon: "shield",
    title: "Verify every guest",
    desc: "Admins and photographers check attendees in on-site with a registration code or a QR scan — no guesswork.",
  },
  {
    icon: "camera",
    title: "Share media safely",
    desc: "Upload photos and videos after the event straight from the dashboard — only checked-in guests ever see them.",
  },
];

export default function HowItWorksPage() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="How it works"
        title="From registration to a private gallery, in three steps."
        subtitle="EventMedia handles the whole loop — discovery, registration, on-site verification, and secure media sharing — so organizers and guests both know exactly what happens next."
        image="https://picsum.photos/seed/eventmedia-howitworks/900/700"
      />

      <div className="container">
        <div className="section">
          <SectionHeader title="For guests" subtitle="What happens after you find an event you like" />
          <div className="grid grid-3">
            {guestSteps.map((step, idx) => (
              <Card key={step.title} className="relative">
                <div className="flex items-start justify-between">
                  <IconBadge icon={step.icon} tone="brand" />
                  <span className="text-slate-200 font-display font-extrabold text-4xl leading-none">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 mb-1.5 text-lg font-bold">{step.title}</h3>
                <p className="text-muted">{step.desc}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="section">
          <SectionHeader title="For organizers & photographers" subtitle="Running the event from the other side" />
          <div className="grid grid-3">
            {organizerPoints.map((point, idx) => (
              <Card key={point.title} className="relative">
                <div className="flex items-start justify-between">
                  <IconBadge icon={point.icon} tone="accent" />
                  <span className="text-slate-200 font-display font-extrabold text-4xl leading-none">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 mb-1.5 text-lg font-bold">{point.title}</h3>
                <p className="text-muted">{point.desc}</p>
              </Card>
            ))}
          </div>
        </div>

        <div className="section mb-4">
          <div className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 text-white px-8 py-14 text-center shadow-lg shadow-brand-900/20">
            <h2 className="m-0 text-3xl sm:text-4xl font-extrabold">Ready to see it in action?</h2>
            <p className="mt-3 text-brand-100 max-w-lg mx-auto">
              Browse what's happening now, or create an account to start organizing your own event.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link className="btn bg-white text-brand-700 hover:bg-brand-50 text-base px-6 py-3.5" to="/events">
                Explore events
              </Link>
              <Link className="btn bg-brand-800/60 text-white border border-white/20 hover:bg-brand-800 text-base px-6 py-3.5" to="/register">
                Create account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
