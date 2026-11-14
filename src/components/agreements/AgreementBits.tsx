import { AgreementStatus, AgreementType, STATUS_LABELS, TYPE_LABELS } from "@/lib/agreements";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<AgreementStatus, string> = {
  draft: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  executed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

export const StatusBadge = ({ status }: { status: AgreementStatus }) => (
  <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLES[status])}>{STATUS_LABELS[status]}</span>
);

export const TypeBadge = ({ type }: { type: AgreementType }) => (
  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{TYPE_LABELS[type]}</span>
);
