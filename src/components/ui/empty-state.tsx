import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {Icon ? (
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-surface-subtle">
          <Icon className="size-5 text-fg-tertiary" aria-hidden />
        </span>
      ) : null}
      <p className="text-[15px] font-medium text-fg">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13px] text-fg-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
