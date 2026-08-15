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

export default function IconBadge({ icon = "register", tone = "brand" }) {
  const toneClasses = {
    brand: "bg-brand-50 text-brand-600",
    accent: "bg-accent-50 text-accent-600",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl ${toneClasses[tone]}`}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {icons[icon]}
      </svg>
    </div>
  );
}
