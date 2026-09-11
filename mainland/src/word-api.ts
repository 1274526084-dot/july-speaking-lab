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
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || '请求失败，请稍后重试。');
  return payload;
}

export async function blobToAudio(blob: Blob) {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return { type: blob.type || 'audio/webm', data: base64 };
}

export type WordItem = {
  id: string;
  word: string;
  meaning: string;
  phonetic: string;
  example: string;
  audioUrl?: string;
  audio_file_id?: string;
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
