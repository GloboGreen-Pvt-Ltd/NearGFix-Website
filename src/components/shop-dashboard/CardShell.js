export default function CardShell({ title, action, children }) {
  return (
    <section className="rounded-3xl border border-[#ECECEC] bg-[#F8F8F8] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-[#111111]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
