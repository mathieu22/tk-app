// Icônes pilotées par des données (types de frais, modes de paiement…).
// Ailleurs, importer directement depuis lucide-react.
import {
  Banknote, Building2, Check, Clock, CreditCard, FileText, GraduationCap, Smartphone, X,
  type LucideProps,
} from "lucide-react";

const ICONS = {
  banknote: Banknote,
  "building-2": Building2,
  check: Check,
  clock: Clock,
  "credit-card": CreditCard,
  "file-text": FileText,
  "graduation-cap": GraduationCap,
  smartphone: Smartphone,
  x: X,
};

export function Icon({ name, ...props }: LucideProps & { name: string }) {
  const C = ICONS[name as keyof typeof ICONS] ?? X;
  return <C {...props} />;
}
