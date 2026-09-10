import { cleanInt, cleanText, extensionFor, getLabStore, isTeacher, json, listAttempts, submissionAllowed } from '../_shared.js';

const SCENE_IDS = new Set(['dormitory', 'club', 'classroom', 'canteen']);
const MAX_CLIP_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;

function isAudioFile(value) {
  return value && typeof value !== 'string' && typeof value.arrayBuffer === 'function' && Number(value.size) > 0;
}

export async function onRequestGet({ request }) {
  if (!(await isTeacher(request))) return json({ ok: false, error: 'Unauthorized' }, 401);
  const rows = await listAttempts(300);
  return json({ ok: true, rows });
}

export async function onRequestPost({ request }) {
  if (!(await submissionAllowed(request))) {
    return json({ ok: false, error: '提交次数过多，请稍后再试。' }, 429);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: '提交格式不正确。' }, 400);
  }

  let body;
  const payloadValue = form.get('payload');
  if (typeof payloadValue !== 'string') return json({ ok: false, error: '练习数据无法读取。' }, 400);
  try {
    body = JSON.parse(payloadValue);
  } catch {
    return json({ ok: false, error: '练习数据无法读取。' }, 400);
  }

  const studentName = cleanText(body.studentName, 40);
  const studentId = cleanText(body.studentId, 40);
  const className = cleanText(body.className, 60);
  const sceneId = cleanText(body.sceneId, 30);
  const sceneTitle = cleanText(body.sceneTitle, 100);
  const transcript = cleanText(body.transcript, 4000);
  const feedback = cleanText(body.feedback, 1000);
  const files = form.getAll('audio').filter(isAudioFile);
  const totalBytes = files.reduce((sum, file) => sum + Number(file.size), 0);

  if (!studentName || !studentId || !className || !SCENE_IDS.has(sceneId) || !transcript) {
    return json({ ok: false, error: '请填写姓名、学号和班级，并完成三轮对话。' }, 400);
  }
  if (body.recordingConsent !== true || files.length < 1) {
    return json({ ok: false, error: '正式提交需要学生同意上传本次练习录音。' }, 400);
  }
  if (files.length > 3 || totalBytes > MAX_TOTAL_BYTES || files.some((file) => Number(file.size) > MAX_CLIP_BYTES || !String(file.type).startsWith('audio/'))) {
    return json({ ok: false, error: '录音数量、大小或格式不符合要求，请重新录制。' }, 400);
  }

  const id = crypto.randomUUID();
  const submittedAt = Date.now();
  const date = new Date(submittedAt).toISOString().slice(0, 10);
  const store = getLabStore();
  const audioManifest = [];

  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const type = String(file.type || 'audio/webm');
      const key = `audio/${date}/${id}/round-${index + 1}.${extensionFor(type)}`;
      await store.set(key, await file.arrayBuffer());
      audioManifest.push({ key, type, size: Number(file.size), round: index + 1 });
    }

    const attempt = {
      id,
      student_name: studentName,
      student_id: studentId,
      class_name: className,
      scene_id: sceneId,
      scene_title: sceneTitle,
      transcript,
      coverage: cleanInt(body.coverage, 0, 100),
      confidence: body.confidence == null ? null : cleanInt(body.confidence, 0, 100),
      duration_seconds: cleanInt(body.durationSeconds, 1, 7200),
      attempts: cleanInt(body.attempts, 1, 20),
      task_score: cleanInt(body.taskScore, 0, 40),
      sentence_score: cleanInt(body.sentenceScore, 0, 30),
      clarity_score: cleanInt(body.clarityScore, 0, 20),
      interaction_score: cleanInt(body.interactionScore, 0, 10),
      total_score: cleanInt(body.totalScore, 0, 100),
      feedback,
      audio_manifest: JSON.stringify(audioManifest),
      submitted_at: submittedAt,
    };
    const reverseTime = String(9999999999999 - submittedAt).padStart(13, '0');
    const attemptKey = `attempts/${date}/${reverseTime}-${id}.json`;
    await store.setJSON(attemptKey, attempt);
    await store.setJSON(`attempt-by-id/${id}.json`, { key: attemptKey });
  } catch {
    await Promise.allSettled(audioManifest.map((item) => store.delete(item.key)));
    return json({ ok: false, error: '上传未完成，请检查网络后重试。' }, 500);
  }

  return json({ ok: true, id });
}

export function onRequest() {
  return json({ ok: false, error: 'Method not allowed' }, 405, { allow: 'GET, POST' });
}
