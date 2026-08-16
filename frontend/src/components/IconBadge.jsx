const icons = {
  register: (
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0M18 7v4M16 9h4" strokeLinecap="round" strokeLinejoin="round" />
  ),
  checkin: (
    <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
  ),
  unlock: (
    <path d="M7 10V7a5 5 0 0 1 9.5-2.2M7 10h11v10H7V10Z" strokeLinecap="round" strokeLinejoin="round" />
  ),
  publish: (
    <path d="M12 3v12m0-12 4 4m-4-4-4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
  ),
  shield: (
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" strokeLinecap="round" strokeLinejoin="round" />
  ),
  camera: (
    <path d="M4 8h3l2-2h6l2 2h3v11H4V8Z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" strokeLinecap="round" strokeLinejoin="round" />
  ),
};

// brand/accent/slate map onto the exact same blue/amber/grey used by Badge's
// info/warn/neutral variants; success is the one tone Badge has that this
// didn't, added here so every colored-icon-badge in the app (stat cards
// included) draws from one shared palette rather than two similar-but-not-
// identical ones.
const TONE_CLASSES = {
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  accent: "bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400",
  success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const SIZE_CLASSES = {
  md: "w-12 h-12 rounded-2xl",
  sm: "w-10 h-10 rounded-xl",
};

export default function IconBadge({ icon = "register", tone = "brand", size = "md" }) {
  return (
    <div className={`inline-flex items-center justify-center shrink-0 ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]}`}>
      <svg width={size === "sm" ? 20 : 24} height={size === "sm" ? 20 : 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {icons[icon]}
      </svg>
    </div>
  );
}
