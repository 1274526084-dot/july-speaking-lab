import { getStore } from '@edgeone/pages-blob';
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const STORE_NAME = 'july-speaking-lab';
const SESSION_COOKIE = 'july_teacher_session';
const SESSION_SECONDS = 8 * 60 * 60;
const DEFAULT_PASSWORD_SALT = 'db0ec8f7c8632bb51ebccc49114ba1f8';
const DEFAULT_PASSWORD_HASH = '7847a75d46d7436bca0f3895644ae0cff889215c859ba3390aaa5aa5f5f53cb8';

export function getLabStore() {
  return getStore({ name: STORE_NAME, consistency: 'strong' });
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function cleanInt(value, min, max) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseCookies(request) {
  const result = new Map();
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    result.set(part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim()));
  }
  return result;
}

export function passwordMatches(password, env = {}) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) return false;
  const salt = env.TEACHER_PASSWORD_SALT || DEFAULT_PASSWORD_SALT;
  const expectedHex = env.TEACHER_PASSWORD_HASH || DEFAULT_PASSWORD_HASH;
  if (!/^[0-9a-f]{64}$/i.test(expectedHex)) return false;
  const actual = pbkdf2Sync(password, salt, 210000, 32, 'sha256');
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export async function createTeacherSession() {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_SECONDS * 1000;
  await getLabStore().setJSON(`auth/sessions/${sha256(token)}.json`, { expiresAt, createdAt: Date.now() });
  return {
    token,
    cookie: `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`,
  };
}

export async function deleteTeacherSession(request) {
  const token = parseCookies(request).get(SESSION_COOKIE) || '';
  if (/^[A-Za-z0-9_-]{32,100}$/.test(token)) {
    await getLabStore().delete(`auth/sessions/${sha256(token)}.json`).catch(() => undefined);
  }
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export async function isTeacher(request) {
  const token = parseCookies(request).get(SESSION_COOKIE) || '';
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(token)) return false;
  const key = `auth/sessions/${sha256(token)}.json`;
  const session = await getLabStore().get(key, { type: 'json', consistency: 'strong' }).catch(() => null);
  if (!session || Number(session.expiresAt) <= Date.now()) {
    if (session) await getLabStore().delete(key).catch(() => undefined);
    return false;
  }
  return true;
}

export function clientIp(request) {
  return (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
}

export async function loginRateState(request, success) {
  const store = getLabStore();
  const key = `auth/rate/${sha256(clientIp(request))}.json`;
  const now = Date.now();
  const current = await store.get(key, { type: 'json', consistency: 'strong' }).catch(() => null);
  if (success) {
    if (current) await store.delete(key).catch(() => undefined);
    return { blocked: false, remaining: 8 };
  }
  const active = current && Number(current.resetAt) > now;
  const count = active ? Number(current.count || 0) + 1 : 1;
  const resetAt = active ? Number(current.resetAt) : now + 15 * 60 * 1000;
  await store.setJSON(key, { count, resetAt });
  return { blocked: count >= 8, remaining: Math.max(0, 8 - count) };
}

export async function loginIsBlocked(request) {
  const key = `auth/rate/${sha256(clientIp(request))}.json`;
  const current = await getLabStore().get(key, { type: 'json', consistency: 'strong' }).catch(() => null);
  return Boolean(current && Number(current.resetAt) > Date.now() && Number(current.count) >= 8);
}

export async function submissionAllowed(request) {
  const store = getLabStore();
  const key = `submission-rate/${sha256(clientIp(request))}.json`;
  const now = Date.now();
  const current = await store.get(key, { type: 'json', consistency: 'strong' }).catch(() => null);
  const active = current && Number(current.resetAt) > now;
  const count = active ? Number(current.count || 0) + 1 : 1;
  const resetAt = active ? Number(current.resetAt) : now + 15 * 60 * 1000;
  await store.setJSON(key, { count, resetAt });
  return count <= 12;
}

async function listBlobKeys(prefix, max) {
  const store = getLabStore();
  const keys = [];
  let cursor;
  do {
    const page = await store.list({ prefix, paginate: false, cursor, consistency: 'strong' });
    for (const blob of page.blobs || []) {
      keys.push(blob.key);
      if (keys.length >= max) return keys;
    }
    cursor = page.cursor;
  } while (cursor);
  return keys;
}

export async function listAttempts(limit = 300) {
  const keys = await listBlobKeys('attempts/', Math.max(1, Math.min(2000, limit)));
  const store = getLabStore();
  const rows = [];
  for (let index = 0; index < keys.length; index += 20) {
    const batch = keys.slice(index, index + 20);
    const values = await Promise.all(batch.map((key) => store.get(key, { type: 'json', consistency: 'strong' }).catch(() => null)));
    values.forEach((value) => { if (value?.id) rows.push(value); });
  }
  return rows.sort((left, right) => Number(right.submitted_at) - Number(left.submitted_at)).slice(0, limit);
}

export async function getAttemptById(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const store = getLabStore();
  const lookup = await store.get(`attempt-by-id/${id}.json`, { type: 'json', consistency: 'strong' }).catch(() => null);
  if (!lookup?.key) return null;
  return store.get(lookup.key, { type: 'json', consistency: 'strong' }).catch(() => null);
}

export function extensionFor(type) {
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('mp4') || type.includes('m4a')) return 'm4a';
  return 'webm';
}
