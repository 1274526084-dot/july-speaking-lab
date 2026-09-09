import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { scenes } from '@/lib/scenes';

const sceneIds = new Set(scenes.map((scene) => scene.id));

function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanInt(value: unknown, min: number, max: number) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : min;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 }); }

  const studentName = cleanText(body.studentName, 40);
  const studentId = cleanText(body.studentId, 40);
  const className = cleanText(body.className, 60);
  const sceneId = cleanText(body.sceneId, 30);
  const sceneTitle = cleanText(body.sceneTitle, 100);
  const transcript = cleanText(body.transcript, 4000);
  if (!studentName || !studentId || !className || !sceneIds.has(sceneId as never) || !transcript) {
    return NextResponse.json({ ok: false, error: '练习信息不完整。' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await getDb().prepare(`
    INSERT INTO speaking_attempts (
      id, student_name, student_id, class_name, scene_id, scene_title,
      transcript, coverage, confidence, duration_seconds, attempts, submitted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, studentName, studentId, className, sceneId, sceneTitle,
    transcript, cleanInt(body.coverage, 0, 100),
    body.confidence === null || body.confidence === undefined ? null : cleanInt(body.confidence, 0, 100),
    cleanInt(body.durationSeconds, 1, 7200), cleanInt(body.attempts, 1, 100), Date.now(),
  ).run();

  return NextResponse.json({ ok: true, id });
}
