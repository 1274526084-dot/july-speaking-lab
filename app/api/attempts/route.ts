import { NextResponse } from 'next/server';
import { getAudioBucket, getDb } from '@/lib/db';
import { scenes, type SceneId } from '@/lib/scenes';

const sceneIds = new Set<SceneId>(scenes.map((scene) => scene.id));
const MAX_CLIP_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

type AudioMeta = { key: string; type: string; size: number; round: number };

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanInt(value: unknown, min: number, max: number) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}

function extensionFor(type: string) {
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('mp4') || type.includes('m4a')) return 'm4a';
  return 'webm';
}

export async function POST(request: Request) {
  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ ok: false, error: '提交格式不正确。' }, { status: 400 }); }

  let body: Record<string, unknown>;
  const payloadValue = form.get('payload');
  if (typeof payloadValue !== 'string') return NextResponse.json({ ok: false, error: '练习数据无法读取。' }, { status: 400 });
  try { body = JSON.parse(payloadValue) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: '练习数据无法读取。' }, { status: 400 }); }

  const studentName = cleanText(body.studentName, 40);
  const studentId = cleanText(body.studentId, 40);
  const className = cleanText(body.className, 60);
  const sceneId = cleanText(body.sceneId, 30) as SceneId;
  const sceneTitle = cleanText(body.sceneTitle, 100);
  const transcript = cleanText(body.transcript, 4000);
  const feedback = cleanText(body.feedback, 1000);
  const consent = body.recordingConsent === true;
  const files = form.getAll('audio').filter((item): item is File => item instanceof File && item.size > 0);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  if (!studentName || !studentId || !className || !sceneIds.has(sceneId) || !transcript) {
    return NextResponse.json({ ok: false, error: '请填写姓名、学号和班级，并完成三轮对话。' }, { status: 400 });
  }
  if (!consent || files.length < 1) {
    return NextResponse.json({ ok: false, error: '正式提交需要学生同意上传本次练习录音。' }, { status: 400 });
  }
  if (files.length > 3 || totalBytes > MAX_TOTAL_BYTES || files.some((file) => file.size > MAX_CLIP_BYTES || !file.type.startsWith('audio/'))) {
    return NextResponse.json({ ok: false, error: '录音数量、大小或格式不符合要求，请重新录制。' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const date = new Date().toISOString().slice(0, 10);
  const bucket = getAudioBucket();
  const audioManifest: AudioMeta[] = [];

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const type = file.type || 'audio/webm';
      const key = `speaking/${date}/${id}/round-${index + 1}.${extensionFor(type)}`;
      await bucket.put(key, file.stream(), { httpMetadata: { contentType: type } });
      audioManifest.push({ key, type, size: file.size, round: index + 1 });
    }

    await getDb().prepare(`
      INSERT INTO speaking_attempts (
        id, student_name, student_id, class_name, scene_id, scene_title,
        transcript, coverage, confidence, duration_seconds, attempts,
        task_score, sentence_score, clarity_score, interaction_score, total_score,
        feedback, audio_manifest, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, studentName, studentId, className, sceneId, sceneTitle,
      transcript, cleanInt(body.coverage, 0, 100),
      body.confidence === null || body.confidence === undefined ? null : cleanInt(body.confidence, 0, 100),
      cleanInt(body.durationSeconds, 1, 7200), cleanInt(body.attempts, 1, 20),
      cleanInt(body.taskScore, 0, 40), cleanInt(body.sentenceScore, 0, 30),
      cleanInt(body.clarityScore, 0, 20), cleanInt(body.interactionScore, 0, 10),
      cleanInt(body.totalScore, 0, 100), feedback, JSON.stringify(audioManifest), Date.now(),
    ).run();
  } catch {
    if (audioManifest.length) await bucket.delete(audioManifest.map((item) => item.key));
    return NextResponse.json({ ok: false, error: '上传未完成，请检查网络后重试。' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
