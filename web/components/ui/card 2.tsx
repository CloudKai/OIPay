import clsx from "clsx";

export function Card({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-slate-200/90 bg-white p-5 shadow-[0_12px_40px_-24px_rgba(15,23,42,0.35)] transition-shadow",
        className
      )}
    >
      {children}
    </div>
  );
}
