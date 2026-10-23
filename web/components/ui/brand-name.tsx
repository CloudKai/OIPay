import { cn } from "@/lib/utils";

/** Keep the name searchable as ASCII while drawing an unambiguous capital I. */
export function BrandName({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="OIPay" className={cn("inline-flex items-baseline whitespace-nowrap", className)}>
      <span aria-hidden="true">O</span>
      <svg aria-hidden="true" viewBox="0 0 12 18" width="0.46em" height="0.72em" className="mx-[0.025em] shrink-0 fill-current">
        <path d="M0 0h12v2.5H7.5v13H12V18H0v-2.5h4.5v-13H0Z" />
      </svg>
      <span aria-hidden="true">Pay</span>
    </span>
  );
}
