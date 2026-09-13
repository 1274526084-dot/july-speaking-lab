export const WORD_API_URL = 'https://cloudbase-d3gxxe4l88c3d5907-1431364187.ap-shanghai.app.tcloudbase.com/wordLabApi';

const TOKEN_KEY = 'july-word-lab.staff-token';
const ROLE_KEY = 'july-word-lab.staff-role';
const siteBase = import.meta.env.BASE_URL.replace(/\/$/, '');

export function wordPath(path = '') {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  return `${siteBase}/words/${normalized}${normalized ? '/' : ''}`;
}

export function getWordToken() {
  return window.sessionStorage.getItem(TOKEN_KEY) || '';
}

export function getWordRole() {
  return window.sessionStorage.getItem(ROLE_KEY) || '';
}

export function setWordSession(token: string, role: string) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
  window.sessionStorage.setItem(ROLE_KEY, role);
}

export function clearWordSession() {
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(ROLE_KEY);
}

export async function wordRequest<T>(action: string, data: Record<string, unknown> = {}, token = '') {
  const response = await fetch(WORD_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, token, ...data }),
  });
  const raw = await response.text();
  let payload: T & { error?: string; message?: string; code?: string };
  try { payload = JSON.parse(raw) as T & { error?: string; message?: string; code?: string }; }
  catch { payload = {} as T & { error?: string; message?: string; code?: string }; }
  if (!response.ok) {
    const oversize = response.status === 413 || payload.code === 'EXCEED_MAX_PAYLOAD_SIZE';
    throw new Error(oversize ? '录音文件太大，请重新录制；读完单词后立即点“我读完了”。' : payload.error || payload.message || `请求失败（${response.status}），请稍后重试。`);
  }
  return payload;
}

function encodeMonoWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

export async function prepareAudioForUpload(blob: Blob) {
  const maxUploadBytes = 650_000;
  const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const OfflineConstructor = window.OfflineAudioContext || (window as typeof window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!AudioContextConstructor || !OfflineConstructor) {
    if (blob.size <= maxUploadBytes) return blob;
    throw new Error('这段录音体积过大，请重新录制并在读完后立即停止。');
  }
  const context = new AudioContextConstructor();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (decoded.duration > 15) throw new Error('单词录音请控制在15秒以内。');
    const sampleRate = 16_000;
    const length = Math.max(1, Math.ceil(decoded.duration * sampleRate));
    const offline = new OfflineConstructor(1, length, sampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded; source.connect(offline.destination); source.start();
    const rendered = await offline.startRendering();
    const compressed = new Blob([encodeMonoWav(rendered.getChannelData(0), sampleRate)], { type: 'audio/wav' });
    if (compressed.size > maxUploadBytes) throw new Error('这段录音体积过大，请重新录制并在读完后立即停止。');
    return compressed;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('15秒') || error.message.includes('体积过大'))) throw error;
    if (blob.size <= maxUploadBytes) return blob;
    throw new Error('录音处理失败，请重新录制并在读完后立即停止。');
  } finally {
    await context.close().catch(() => undefined);
  }
}

export type WordUploadTicket = {
  url: string;
  token: string;
  authorization: string;
  fileId: string;
  cosFileId: string;
  cloudPath: string;
};

export async function uploadWordAudio(ticket: WordUploadTicket, blob: Blob) {
  const response = await fetch(ticket.url, {
    method: 'PUT',
    headers: {
      Signature: ticket.authorization,
      authorization: ticket.authorization,
      'x-cos-security-token': ticket.token,
      'x-cos-meta-fileid': ticket.cosFileId,
      key: encodeURIComponent(ticket.cloudPath),
    },
    body: blob,
  });
  if (!response.ok) throw new Error('录音上传没有完成，请检查网络后再试。');
}

export type WordItem = {
  id: string;
  word: string;
  meaning: string;
  phonetic: string;
  example: string;
  audioUrl?: string;
  audioUrls?: string[];
  audio_file_id?: string;
  audio_file_ids?: string[];
  audio_type?: string;
  audio_source?: string;
  source_url?: string;
};

export type WordUnit = {
  id: string;
  title: string;
  note: string;
  shareCode: string;
  share_code?: string;
  teacherName: string;
  teacher_name?: string;
  status?: string;
  words: WordItem[];
  wordCount?: number;
  demoCount?: number;
  published_at?: number | null;
  updated_at?: number;
};

export type WordResult = {
  word_id: string;
  word: string;
  transcript: string;
  confidence: number;
  system_score: number;
  self_rating: number;
  audioUrl?: string;
  scoring_mode?: 'speech-recognition' | 'acoustic-fallback' | 'no-speech';
  acoustic_score?: number;
  reference_compared?: boolean;
  duration_ms?: number;
};

export type WordAttempt = {
  id: string;
  teacher_id: string;
  teacher_name: string;
  unit_id: string;
  unit_title: string;
  student_name: string;
  class_name: string;
  average_score: number;
  average_self: number;
  submitted_at: number;
  results: WordResult[];
};
