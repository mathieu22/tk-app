// Valeurs par défaut et libellés des Réglages (partagés client / serveur, sans dépendance serveur).

/** Couleurs par défaut du design GPH (identiques à :root de globals.css). */
export const DEFAULT_COLORS: Record<string, string> = {
  "--gph-primary": "#1b5e20",
  "--gph-primary-deep": "#154a18",
  "--gph-primary-soft": "#e8f1e8",
  "--gph-accent": "#4caf50",
  "--gph-droit": "#1565c0",
  "--gph-droit-soft": "#e3f2fd",
  "--gph-passport": "#6a1b9a",
  "--gph-passport-soft": "#f3e5f5",
  "--gph-ecolage": "#00695c",
  "--gph-ecolage-soft": "#e0f2f1",
  "--gph-success": "#10b981",
  "--gph-warning": "#f59e0b",
  "--gph-danger": "#ef4444",
};

export const PROFILE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  PRESIDENT: "Président",
  SECRETARY: "Secrétaire",
  TREASURER: "Trésorier",
  COACH: "Encadrant",
  ATHLETE: "Athlète",
  PARENT: "Parent",
};

/** Profil d'accès proposé selon le poste du membre (US-2.5 règles générales). */
export const PROFILE_FOR_POSITION: Record<string, string> = {
  PRESIDENT: "PRESIDENT",
  VICE_PRESIDENT: "PRESIDENT",
  SECRETARY: "SECRETARY",
  TREASURER: "TREASURER",
  COACH: "COACH",
  ATHLETE: "ATHLETE",
};

/** Icônes proposées pour les types d'événements (noms lucide). */
export const EVENT_ICONS = [
  "dumbbell", "award", "trophy", "sparkles", "users", "party-popper", "calendar-days", "flag", "medal", "megaphone", "bus", "heart",
] as const;

/** Libellés français des actions du journal d'audit (US-8.4). */
export const AUDIT_LABELS: Record<string, string> = {
  "payment.create": "Paiement enregistré",
  "payment.cancel": "Paiement annulé",
  "attendance.correct": "Présence corrigée",
  "member.create": "Membre créé",
  "member.update": "Membre modifié",
  "member.archive": "Membre archivé",
  "member.delete": "Membre supprimé",
  "member.qr.regenerate": "QR code régénéré",
  "auth.fail": "Échec de connexion",
  "parent.link": "Tuteur associé",
  "parent.unlink": "Tuteur dissocié",
  "role.change": "Profil modifié",
  "user.create": "Utilisateur créé",
  "user.activate": "Utilisateur réactivé",
  "user.deactivate": "Utilisateur désactivé",
  "user.reset": "Réinitialisation du mot de passe",
  "user.invite": "Invitation envoyée",
  "settings.colors": "Couleurs modifiées",
  "settings.association": "Paramètres de l'association modifiés",
  "settings.tariffs": "Montants modifiés",
  "settings.permissions": "Matrice des permissions modifiée",
  "settings.groups": "Groupes modifiés",
  "settings.eventTypes": "Types d'événements modifiés",
  "session.series": "Séances récurrentes créées",
  "export.full": "Export complet",
  "backup.run": "Sauvegarde automatique",
};
export const auditLabel = (action: string) => AUDIT_LABELS[action] ?? action;

/** Luminance relative WCAG d'une couleur #rrggbb. */
export function luminance(hex: string) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG (1 à 21). */
export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
