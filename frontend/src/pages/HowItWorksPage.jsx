import { Link } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout.jsx";
import PageHero from "../components/PageHero.jsx";
import Card from "../components/ui/Card.jsx";
import SectionHeader from "../components/ui/SectionHeader.jsx";
import IconBadge from "../components/IconBadge.jsx";

// The guest side is one linear path everyone takes the same way, so it stays
// a grid of equal, parallel steps.
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

// The organizer side is not one role doing one thing - it's the admin
// setting the event up and assigning the team, staff verifying guests on
// site, and the photographer uploading afterward. Each step names who is
// actually doing it, and the timeline layout below reflects that it is a
// handoff between roles rather than one person's checklist.
const organizerSteps = [
  {
    icon: "publish",
    role: "Admin",
    title: "Create and publish the event",
    desc: "Set the title, schedule, and visibility from the console. Publish it live and public, or keep it private and unlisted until you're ready.",
  },
  {
    icon: "camera",
    role: "Admin",
    title: "Bring a photographer onto it",
    desc: "Assign a photographer straight from the event card. Only the photographer you assign — and admins — can ever upload to that event.",
  },
  {
    icon: "shield",
    role: "Admin & staff",
    title: "Verify guests at the door",
    desc: "Scan a QR code or type a registration code at check-in. The gallery only unlocks for people actually verified on site, never the full guest list.",
  },
  {
    icon: "unlock",
    role: "Photographer",
    title: "Upload as the event happens",
    desc: "Drop in as many photos and videos as you've shot in one go, straight from the console. Checked-in guests see them the moment they're up.",
  },
];

export default function HowItWorksPage() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="How it works"
        title="Two sides of the same event, run differently."
        subtitle="Guests follow one simple path. Organizers and photographers run the event from the other side — setting it up, verifying who's really there, and sharing the moment afterward."
        image="https://picsum.photos/seed/eventmedia-howitworks/900/700"
      />

      <div className="shell-wrap">
        <div className="section">
          <SectionHeader title="For guests" subtitle="One path, the same for everyone" />
          <div className="grid grid-3">
            {guestSteps.map((step, idx) => (
              <Card key={step.title} className="relative">
                <div className="flex items-start justify-between">
                  <IconBadge icon={step.icon} tone="brand" />
                  <span className="text-slate-200 dark:text-slate-700 font-display font-extrabold text-4xl leading-none">
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
          <SectionHeader title="For organizers & photographers" subtitle="A handoff between roles, not one person's checklist" />

          <div className="relative max-w-2xl">
            {/* Connecting line running behind the numbered circles - this is
                what makes it read as a sequence rather than a grid of
                interchangeable cards. */}
            <div className="absolute left-[27px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />

            <div className="stack gap-8">
              {organizerSteps.map((step, idx) => (
                <div key={step.title} className="relative flex gap-5">
                  <div className="relative z-10 shrink-0">
                    <IconBadge icon={step.icon} tone="accent" />
                  </div>
                  <Card className="flex-1 !py-5">
                    <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                      <span className="text-xs font-bold text-accent-600 dark:text-accent-400 uppercase tracking-wide">
                        Step {idx + 1} · {step.role}
                      </span>
                    </div>
                    <h3 className="m-0 mb-1.5 text-lg font-bold">{step.title}</h3>
                    <p className="text-muted m-0">{step.desc}</p>
                  </Card>
                </div>
              ))}
            </div>
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
