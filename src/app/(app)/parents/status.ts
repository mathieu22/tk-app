/** État du compte d'un parent : pas de compte, invité (en attente d'activation), activé. */
export function accountStatus(user: { active: boolean; lastLoginAt: Date | null } | null) {
  if (!user) return { key: "sans", label: "Sans compte", tone: "neutral" } as const;
  if (!user.active) return { key: "invites", label: "Invité", tone: "warning" } as const;
  return { key: "actifs", label: "Activé", tone: "success" } as const;
}
