import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getAudioBucket, getDb, getTeacherEmail } from '@/lib/db';

export const dynamic = 'force-dynamic';
type AudioMeta = { key: string; type: string; size: number; round: number };

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  const teacherEmail = getTeacherEmail();
  if (!user || !teacherEmail || user.email.toLowerCase() !== teacherEmail) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const attempt = (url.searchParams.get('attempt') ?? '').trim();
  const clipIndex = Number(url.searchParams.get('clip') ?? '0');
  if (!/^[0-9a-f-]{36}$/i.test(attempt) || !Number.isInteger(clipIndex) || clipIndex < 0 || clipIndex > 2) {
    return new Response('Invalid audio request', { status: 400 });
  }

  const row = await getDb().prepare('SELECT audio_manifest FROM speaking_attempts WHERE id = ? LIMIT 1').bind(attempt).first<{ audio_manifest: string | null }>();
  if (!row?.audio_manifest) return new Response('Recording not found', { status: 404 });

  let manifest: AudioMeta[];
  try { manifest = JSON.parse(row.audio_manifest) as AudioMeta[]; }
  catch { return new Response('Recording metadata is invalid', { status: 500 }); }
  const clip = manifest[clipIndex];
  if (!clip?.key) return new Response('Recording not found', { status: 404 });

  const object = await getAudioBucket().get(clip.key);
  if (!object) return new Response('Recording not found', { status: 404 });
  const extension = clip.type.includes('ogg') ? 'ogg' : clip.type.includes('mp4') ? 'm4a' : 'webm';
  return new Response(object.body, {
    status: 200,
    headers: {
      'content-type': clip.type || 'audio/webm',
      'content-length': String(object.size),
      'cache-control': 'private, no-store',
      'content-disposition': `inline; filename="round-${clip.round}.${extension}"`,
    },
  });
}
