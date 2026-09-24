import {
  Atom,
  Cpu,
  Dna,
  FlaskConical,
  Globe,
  Leaf,
  Microscope,
  Rocket,
  Sigma,
  Telescope,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Danh sách biểu tượng được phép gán cho môn học (admin chọn trong danh sách này). */
export const SUBJECT_ICONS: Record<string, LucideIcon> = {
  atom: Atom,
  "flask-conical": FlaskConical,
  dna: Dna,
  sigma: Sigma,
  globe: Globe,
  leaf: Leaf,
  cpu: Cpu,
  rocket: Rocket,
  microscope: Microscope,
  telescope: Telescope,
};

export function SubjectIcon({ icon, className }: { icon?: string | null; className?: string }) {
  const Icon = (icon && SUBJECT_ICONS[icon]) || FlaskConical;
  return <Icon aria-hidden className={cn("size-4", className)} />;
}
