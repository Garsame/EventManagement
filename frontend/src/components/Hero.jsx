import { Link } from "react-router-dom";

function HeroScene() {
  return (
    <div
      className="w-full h-[300px] sm:h-[380px] lg:h-[440px]"
      style={{
        maskImage: "radial-gradient(ellipse 65% 80% at 50% 48%, black 35%, transparent 88%)",
        WebkitMaskImage: "radial-gradient(ellipse 65% 80% at 50% 48%, black 35%, transparent 88%)",
      }}
    >
      <svg viewBox="0 0 1200 420" className="w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <filter id="heroBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="55" />
          </filter>
          <filter id="cardShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#312e81" floodOpacity="0.18" />
          </filter>
          <linearGradient id="photoGradA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#818cf8" />
            <stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="photoGradB" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fbbf24" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="photoGradC" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#4338ca" />
            <stop offset="1" stopColor="#818cf8" />
          </linearGradient>
        </defs>

        {/* ambient color blobs */}
        <circle cx="150" cy="90" r="180" fill="#a5b4fc" opacity="0.4" filter="url(#heroBlur)" />
        <circle cx="1080" cy="60" r="160" fill="#fbbf24" opacity="0.28" filter="url(#heroBlur)" />
        <circle cx="1100" cy="370" r="200" fill="#6366f1" opacity="0.22" filter="url(#heroBlur)" />

        {/* table */}
        <ellipse cx="600" cy="300" rx="340" ry="58" fill="#eef2ff" />
        <ellipse cx="600" cy="300" rx="340" ry="58" fill="none" stroke="#c7d2fe" strokeWidth="2" opacity="0.7" />

        {/* seated figures, abstract color-block style */}
        {[
          { x: 280, y: 228, fill: "#4338ca" },
          { x: 440, y: 196, fill: "#6366f1" },
          { x: 600, y: 182, fill: "#f59e0b" },
          { x: 760, y: 196, fill: "#334155" },
          { x: 920, y: 228, fill: "#818cf8" },
        ].map((p, i) => (
          <g key={i}>
            <rect x={p.x - 38} y={p.y + 14} width="76" height="92" rx="32" fill={p.fill} opacity="0.92" />
            <circle cx={p.x} cy={p.y} r="27" fill={p.fill} />
          </g>
        ))}

        {/* small camera on the table */}
        <g transform="translate(578, 252)">
          <rect x="0" y="10" width="46" height="32" rx="7" fill="#0f172a" />
          <rect x="14" y="0" width="18" height="10" rx="3" fill="#0f172a" />
          <circle cx="23" cy="26" r="10" fill="#eef2ff" stroke="#0f172a" strokeWidth="2.5" />
          <circle cx="23" cy="26" r="4" fill="#0f172a" />
        </g>

        {/* floating shared-photo cards */}
        <g filter="url(#cardShadow)">
          <g transform="translate(90,36) rotate(-9)">
            <rect width="118" height="86" rx="12" fill="white" />
            <rect x="9" y="9" width="100" height="68" rx="7" fill="url(#photoGradA)" />
          </g>
          <g transform="translate(985,26) rotate(11)">
            <rect width="104" height="78" rx="12" fill="white" />
            <rect x="8" y="8" width="88" height="62" rx="7" fill="url(#photoGradB)" />
          </g>
          <g transform="translate(1040,230) rotate(-7)">
            <rect width="90" height="68" rx="10" fill="white" />
            <rect x="7" y="7" width="76" height="54" rx="6" fill="url(#photoGradC)" />
          </g>
        </g>
      </svg>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="pt-8 sm:pt-14">
      <div className="shell-wrap grid gap-10 lg:grid-cols-2 items-center">
        <div className="text-center lg:text-left">
          <span className="badge badge-info mb-5">Registration · Check-in · Private galleries</span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] text-slate-900 dark:text-white">
            Every event, captured — <span className="text-brand-600">shared only</span> with the people who were there.
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0">
            Create your event, let guests register and check in, and unlock a private, secure photo &amp; video
            gallery the moment they walk through the door. No public dumps, no strangers browsing your memories.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <Link to="/events" className="btn btn-primary text-base px-6 py-3.5">
              Browse events
            </Link>
            <Link to="/how-it-works" className="btn btn-ghost text-base px-6 py-3.5">
              How it works
            </Link>
          </div>
        </div>

        {/* Same treatment as PageHero's stock image elsewhere in the app -
            fixed aspect ratio and object-cover, so it is always fully
            contained rather than spilling past the section. */}
        <div className="rounded-3xl overflow-hidden shadow-xl shadow-slate-900/10 aspect-[4/3]">
          <img
            src="https://picsum.photos/seed/eventmedia-home-hero/900/700"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      <div className="mt-4 sm:mt-6">
        <HeroScene />
      </div>
    </section>
  );
}
