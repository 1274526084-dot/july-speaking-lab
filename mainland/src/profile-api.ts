export const PROFILE_API_URL = 'https://cloudbase-d3gxxe4l88c3d5907-1431364187.ap-shanghai.app.tcloudbase.com/studentProfileApi';

const TOKEN_KEY = 'july-english-profile.teacher-token';
const PROFILE_KEY = 'july-english-profile.student-key';
const siteBase = import.meta.env.BASE_URL.replace(/\/$/, '');

export function profilePath(path = '') {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  return `${siteBase}/profile/${normalized}${normalized ? '/' : ''}`;
}

export function getProfileTeacherToken() {
  return window.sessionStorage.getItem(TOKEN_KEY) || '';
}

export function setProfileTeacherToken(token: string) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearProfileTeacherToken() {
  window.sessionStorage.removeItem(TOKEN_KEY);
}

export function getStudentProfileKey() {
  return window.localStorage.getItem(PROFILE_KEY) || '';
}

export function setStudentProfileKey(key: string) {
  window.localStorage.setItem(PROFILE_KEY, key);
}

export async function profileRequest<T>(action: string, data: Record<string, unknown> = {}, token = '') {
  const response = await fetch(PROFILE_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, token, ...data }),
  });
  const raw = await response.text();
  let payload: T & { error?: string; message?: string };
  try {
    payload = JSON.parse(raw) as T & { error?: string; message?: string };
  } catch {
    payload = {} as T & { error?: string; message?: string };
  }
  if (!response.ok) throw new Error(payload.error || payload.message || `请求失败（${response.status}），请稍后重试。`);
  return payload;
}

export const MAJOR_OPTIONS = [
  '铁道机车运用与维护',
  '城市轨道交通通信信号技术',
  '储能材料技术',
  '新能源汽车技术',
  '其他专业',
] as const;

export const SKILL_LABELS = {
  listening: '听力',
  speaking: '口语',
  reading: '阅读',
  writing: '写作',
  vocabulary: '词汇',
  grammar: '语法',
  pronunciation: '发音',
} as const;

export type SkillKey = keyof typeof SKILL_LABELS;

export type EnglishProfile = {
  id: string;
  student_name: string;
  class_name: string;
  major: string;
  admission_type?: 'gaokao' | 'single';
  entrance_score_known?: boolean;
  entrance_english_score?: number | null;
  entrance_english_full_score?: number | null;
  entrance_english_percent?: number | null;
  gaokao_known?: boolean;
  gaokao_score?: number | null;
  skills: Record<SkillKey, number>;
  confidence: number;
  speaking_anxiety: number;
  english_interest: number;
  weekly_time: string;
  current_habits: string[];
  learning_goals: string[];
  preferred_activities: string[];
  difficulties: string[];
  major_reasons: string[];
  school_reasons: string[];
  career_plan: string;
  semester_goal: string;
  teacher_message: string;
  device_ready: string;
  submitted_at: number;
  updated_at: number;
};
