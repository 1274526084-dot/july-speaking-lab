import { env } from 'cloudflare:workers';

type SiteEnv = Cloudflare.Env & { DB?: D1Database; AUDIO?: R2Bucket; TEACHER_EMAIL?: string };

export function getDb(): D1Database {
  const db = (env as SiteEnv).DB;
  if (!db) throw new Error('D1 binding DB is unavailable');
  return db;
}

export function getTeacherEmail(): string {
  return ((env as SiteEnv).TEACHER_EMAIL ?? '').trim().toLowerCase();
}

export function getAudioBucket(): R2Bucket {
  const bucket = (env as SiteEnv).AUDIO;
  if (!bucket) throw new Error('R2 binding AUDIO is unavailable');
  return bucket;
}
