import { sitePath } from './api';
import { clearCourseIdentity, getCourseIdentity } from './course-session';

export const ARCHIVE_API_URL =
  'https://cloudbase-d3gxxe4l88c3d5907-1431364187.ap-shanghai.app.tcloudbase.com/learningArchiveApi';
const STUDENT_TOKEN = 'july.archive.student-session.v1';
const PENDING = 'july.archive.access-request.v1';
export const archivePath = (path = '') =>
  sitePath(`archive${path ? `/${path}` : ''}`);
export function getArchiveToken() {
  return (
    getCourseIdentity()?.token ||
    sessionStorage.getItem(STUDENT_TOKEN) ||
    localStorage.getItem(STUDENT_TOKEN) ||
    ''
  );
}
export function setArchiveToken(value: string, remember = false) {
  clearArchiveToken();
  (remember ? localStorage : sessionStorage).setItem(STUDENT_TOKEN, value);
}
export function clearArchiveToken() {
  clearCourseIdentity();
  sessionStorage.removeItem(STUDENT_TOKEN);
  localStorage.removeItem(STUDENT_TOKEN);
}
export type AccessRequest = {
  requestToken: string;
  verificationCode: string;
  expiresAt: number;
  name: string;
  className: string;
  remember: boolean;
};
export function getPendingAccess(): AccessRequest | null {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING) || 'null');
  } catch {
    return null;
  }
}
export function setPendingAccess(value: AccessRequest | null) {
  if (value) sessionStorage.setItem(PENDING, JSON.stringify(value));
  else sessionStorage.removeItem(PENDING);
}
export class ArchiveError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function archiveRequest<T>(
  action: string,
  data: Record<string, unknown> = {},
  token = '',
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(ARCHIVE_API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, token, ...data }),
      signal: controller.signal,
    });
    const payload = (await response
      .json()
      .catch(() => ({ error: '服务暂时无法连接，请稍后重试。' }))) as Record<
      string,
      unknown
    >;
    if (!response.ok || payload.ok === false)
      throw new ArchiveError(
        typeof payload.error === 'string' && payload.error
          ? payload.error
          : typeof payload.message === 'string' && payload.message
            ? payload.message
            : '请求失败，请重试。',
        response.status,
      );
    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw new ArchiveError(
        '连接超时，已保存的记录不会因此丢失，请重试。',
        408,
      );
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export type ArchiveQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer?: number;
  explanation?: string;
};
export type ArchiveTask = {
  id: string;
  version?: number | string;
  title: string;
  unit: string;
  lesson: string;
  type: string;
  description: string;
  href?: string;
  classes?: string[];
  dueAt?: number | null;
  status?: string;
  material?: string;
  questions?: ArchiveQuestion[];
  teacherName?: string;
  creatorName?: string;
};
export type ArchiveNews = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedDate: string;
  checkedAt?: string;
  vocabulary?: { word: string; meaning: string }[];
  question?: string;
};
export type ArchiveHistory = {
  id: string;
  type: string;
  title: string;
  submittedAt: number;
  score?: number | null;
  taskId?: string;
  url?: string;
  details?: unknown;
  audio?: { url: string; label?: string }[];
};
export type ArchiveSnapshot = {
  id: string;
  createdAt: number;
  skills: Record<string, number>;
  goals?: string;
};
export type StudentArchiveData = {
  unit2?: Unit2Summary;
  student: { id: string; name: string; className: string };
  profile: {
    skills?: Record<string, number>;
    learning_goals?: string[];
    semester_goal?: string;
    [key: string]: unknown;
  } | null;
  history: ArchiveHistory[];
  tasks: ArchiveTask[];
  news: ArchiveNews[];
  snapshots: ArchiveSnapshot[];
  warnings?: string[];
  hasMore?: boolean;
  summary?: Record<string, unknown>;
};
export type Unit2Stage = {
  first: number;
  latest: number;
  best: number;
  attempts: number;
  submittedAt: number;
};
export type Unit2Summary = {
  stages: Partial<Record<string, Unit2Stage | null>>;
  radar: Partial<Record<string, number | null>>;
  completed: number;
  attemptCount: number;
  pretest: number | null;
  postPractice: number | null;
  change: number | null;
};
