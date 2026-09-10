import { getAttemptById, getLabStore, isTeacher } from '../_shared.js';

export async function onRequestGet({ request }) {
  if (!(await isTeacher(request))) return new Response('Unauthorized', { status: 401 });
  const url = new URL(request.url);
  const attemptId = (url.searchParams.get('attempt') || '').trim();
  const clipIndex = Number(url.searchParams.get('clip') || '0');
  if (!/^[0-9a-f-]{36}$/i.test(attemptId) || !Number.isInteger(clipIndex) || clipIndex < 0 || clipIndex > 2) {
    return new Response('Invalid audio request', { status: 400 });
  }

  const attempt = await getAttemptById(attemptId);
  if (!attempt?.audio_manifest) return new Response('Recording not found', { status: 404 });
  let manifest;
  try {
    manifest = JSON.parse(attempt.audio_manifest);
  } catch {
    return new Response('Recording metadata is invalid', { status: 500 });
  }
  const clip = manifest[clipIndex];
  if (!clip?.key) return new Response('Recording not found', { status: 404 });
  const audio = await getLabStore().get(clip.key, { type: 'arrayBuffer', consistency: 'strong' }).catch(() => null);
  if (!audio) return new Response('Recording not found', { status: 404 });
  return new Response(audio, {
    headers: {
      'content-type': clip.type || 'audio/webm',
      'content-length': String(clip.size || audio.byteLength || ''),
      'cache-control': 'private, no-store',
      'content-disposition': `inline; filename="round-${clip.round || clipIndex + 1}"`,
    },
  });
}

export function onRequest() {
  return new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
}
