// Les dates (JJ/MM/AAAA, mois courant, année scolaire, heure de scan) sont calculées
// à l'heure de Madagascar, quel que soit le fuseau du serveur (Vercel = UTC).
export function register() {
  process.env.TZ = "Indian/Antananarivo";
}
