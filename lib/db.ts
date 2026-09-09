import { env } from 'cloudflare:workers';

type SiteEnv = Cloudflare.Env & { DB?: D1Database; TEACHER_EMAIL?: string };

export function getDb(): D1Database {
  const db = (env as SiteEnv).DB;
  if (!db) throw new Error('D1 binding DB is unavailable');
  return db;
}

export function getTeacherEmail(): string {
  return ((env as SiteEnv).TEACHER_EMAIL ?? '').trim().toLowerCase();
}
