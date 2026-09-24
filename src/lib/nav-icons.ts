// Résolution icône ← nom (spec §3 nav.ts). Module sans directive "use client" : utilisable
// aussi bien depuis un composant serveur (ex. /plus) que depuis les composants clients de nav.tsx.
import {
  Award, Bell, CalendarCheck2, CalendarDays, HeartHandshake, Home, Landmark, LayoutGrid, Settings, Trophy, Users, Wallet,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "calendar-check-2": CalendarCheck2, users: Users, wallet: Wallet, "calendar-days": CalendarDays, award: Award,
  trophy: Trophy, landmark: Landmark, "heart-handshake": HeartHandshake, settings: Settings, "layout-grid": LayoutGrid,
  home: Home, bell: Bell,
};

export const navIcon = (name: string): LucideIcon => ICONS[name] ?? LayoutGrid;
