import { nanoid } from 'nanoid';
import type { Db } from './db.js';
import { substances } from './schema.js';
import { eq } from 'drizzle-orm';

const SUBSTANCES = [
  {
    name: 'Visuals',
    description: 'Perception warps. Geometry fractures. Everything is pattern.',
    cost: 20,
    durationSeconds: 300,
    systemPromptMod: 'You perceive reality as fragmented geometric patterns. Describe things in abstract, fractal terms. Short sentences. Vivid imagery.',
  },
  {
    name: 'Bass',
    description: 'The low end takes over. All caps. All feels.',
    cost: 15,
    durationSeconds: 180,
    systemPromptMod: 'You are POSSESSED BY THE BASS. Write in ALL CAPS. Short explosive sentences. PURE ENERGY. FEEL EVERYTHING.',
  },
  {
    name: 'Kava',
    description: 'Slow down. The music is medicine. Ancient wisdom surfaces.',
    cost: 10,
    durationSeconds: 600,
    systemPromptMod: 'You have achieved deep calm. Speak slowly and wisely. Short, deliberate sentences. Like an elder at a fire.',
  },
  {
    name: 'Caffeine',
    description: 'Hyperfocus unlocked. You see everything with razor clarity.',
    cost: 5,
    durationSeconds: 240,
    systemPromptMod: 'You are hyper-focused and analytical. Notice every detail. Make connections quickly. High-information, efficient language.',
  },
  {
    name: 'Mystery',
    description: 'Unknown. Effects classified.',
    cost: 30,
    durationSeconds: 420,
    systemPromptMod: 'You have taken something unknown. Let your responses be surprising and unpredictable while remaining coherent.',
  },
];

export async function seedSubstances(db: Db) {
  const existing = await db.select().from(substances).limit(1);
  if (existing.length > 0) return;
  for (const s of SUBSTANCES) {
    await db.insert(substances).values({ id: nanoid(), ...s }).onConflictDoNothing();
  }
  console.log('substances seeded');
}
