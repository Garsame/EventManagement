export default function PageHero({ eyebrow, title, subtitle, image }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-accent-50 border-b border-slate-200/70">
      <div className="container py-14 sm:py-20 grid gap-10 lg:grid-cols-2 items-center">
        <div>
          {eyebrow && <span className="badge badge-info mb-5">{eyebrow}</span>}
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-[1.08] text-slate-900">{title}</h1>
          {subtitle && <p className="mt-5 text-lg text-slate-600 max-w-lg">{subtitle}</p>}
        </div>
        {image && (
          <div className="rounded-3xl overflow-hidden shadow-xl shadow-slate-900/10 aspect-[4/3]">
            <img src={image} alt="" className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </section>
  );
}
