// Annexe B — catégories d'âge / poids (kyorugi) et poomsae autorisés, saison 2026.
// Corrections retenues (question ouverte n°4, à valider) : Pupilles G « +27 kg » (doc : +30),
// Pupilles F « +26 kg » et Benjamins G « +49 kg » ajoutés, Masters 1 / 2 / 3 distingués.
import type { PrismaClient } from "../../src/generated/prisma/client";

type Cat = [name: string, ageMin: number, ageMax: number | null, boys: string, girls: string];
const KYORUGI: Cat[] = [
  ["Poussins", 5, 5, "-16,-18,-21,+21", "-15,-17,-20,+20"],
  ["Pupilles", 6, 7, "-18,-21,-24,-27,+27", "-17,-20,-23,-26,+26"],
  ["Benjamins", 8, 9, "-21,-24,-27,-30,-33,-37,-41,-45,-49,+49", "-17,-20,-23,-26,-29,-33,-37,-41,-44,+44"],
  ["Minimes", 10, 11, "-24,-27,-30,-33,-37,-41,-45,-49,-53,-57,+57", "-23,-26,-29,-33,-37,-41,-44,-47,-51,+51"],
  ["Cadets", 12, 14, "-30,-33,-37,-41,-45,-49,-53,-57,-61,-65,+65", "-29,-33,-37,-41,-44,-47,-51,-55,-59,+59"],
  ["Juniors", 15, 17, "-41,-45,-48,-51,-55,-59,-63,-68,-73,-78,+78", "-42,-44,-46,-49,-52,-55,-59,-63,-68,+68"],
  ["Seniors", 18, 29, "-54,-58,-63,-68,-74,-80,-87,+87", "-46,-49,-53,-57,-62,-67,-73,+73"],
  ["Masters 1", 30, 34, "-58,-68,-80,+80", "-49,-57,-67,+67"],
  ["Masters 2", 35, 39, "-58,-68,-80,+80", "-49,-57,-67,+67"],
  ["Masters 3", 40, null, "-58,-68,-80,+80", "-49,-57,-67,+67"],
];

const POOMSAE: [label: string, ageMin: number, ageMax: number | null, list: string][] = [
  ["Benjamins", 8, 9, "Taegeuk 3 Jang, Taegeuk 4 Jang, Taegeuk 5 Jang, Taegeuk 6 Jang"],
  ["Minimes", 10, 11, "Taegeuk 4 Jang, Taegeuk 5 Jang, Taegeuk 6 Jang, Taegeuk 7 Jang"],
  ["Cadets", 12, 14, "Taegeuk 4 Jang, Taegeuk 5 Jang, Taegeuk 6 Jang, Taegeuk 7 Jang, Taegeuk 8 Jang, Koryo, Keumgang, Taebaek"],
  ["Juniors", 15, 17, "Taegeuk 5 Jang, Taegeuk 6 Jang, Taegeuk 7 Jang, Taegeuk 8 Jang, Koryo, Keumgang, Taebaek, Pyongwon"],
  ["Seniors Under 30", 18, 29, "Taegeuk 7 Jang, Taegeuk 8 Jang, Koryo, Keumgang, Taebaek, Pyongwon, Sipjin, Jitae"],
  ["Seniors Under 40", 30, 39, "Taegeuk 7 Jang, Taegeuk 8 Jang, Koryo, Keumgang, Taebaek, Pyongwon, Sipjin, Jitae"],
  ["Seniors Under 50", 40, 49, "Taegeuk 8 Jang, Koryo, Keumgang, Taebaek, Pyongwon, Sipjin, Jitae, Chonkwon"],
  ["Seniors Under 60", 50, 59, "Koryo, Keumgang, Taebaek, Pyongwon, Sipjin, Jitae, Chonkwon, Hansu"],
];

export async function seed(db: PrismaClient) {
  const year = 2026;
  if (await db.season.findUnique({ where: { year } })) return;
  const season = await db.season.create({ data: { year, label: `Saison ${year}` } });
  for (const [order, [name, ageMin, ageMax, boys, girls]] of KYORUGI.entries()) {
    const cat = await db.ageCategory.create({ data: { seasonId: season.id, name, ageMin, ageMax, order } });
    const weights = (sex: string, list: string) =>
      list.split(",").map((w, i) => ({
        ageCategoryId: cat.id, sex, label: `${w} kg`, order: i,
        maxKg: w.startsWith("+") ? null : Number(w.slice(1)),
      }));
    await db.weightCategory.createMany({ data: [...weights("M", boys), ...weights("F", girls)] });
  }
  await db.allowedPoomsae.createMany({
    data: POOMSAE.map(([label, ageMin, ageMax, poomsae]) => ({ seasonId: season.id, label, ageMin, ageMax, poomsae })),
  });
}
