// Service worker GPH — voir src/components/sw-register.tsx. Complété par le module Présence (hors connexion).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
