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

export const COLLEGE_MAJOR_OPTIONS = {
  '汽车与新能源学院': [
    '电力储能应用技术',
    '汽车技术服务与营销',
    '汽车制造与试验技术',
    '新能源汽车技术',
    '智能网联汽车技术',
  ],
  '人工智能及机器人学院': [
    '人工智能技术应用',
    '数字媒体艺术设计',
    '无人机应用技术',
    '智能机器人技术',
  ],
  '铁道工程学院': [
    '道路与桥梁工程技术',
    '工程测量技术',
    '建筑工程技术',
    '铁道工程技术',
    '铁道桥梁隧道工程技术',
  ],
  '铁道机车车辆学院': [
    '城市轨道车辆应用技术',
    '动车组检修技术',
    '铁道车辆技术',
    '铁道供电技术',
    '铁道机车车辆制造与维护',
    '铁道机车运用与维护',
  ],
  '铁道通信信号学院': [
    '城市轨道交通通信信号技术',
    '物联网应用技术',
    '现代通信技术',
    '信息安全技术应用',
    '铁道通信与信息化技术',
    '铁道信号自动控制',
  ],
  '铁道运输管理学院': [
    '城市轨道交通运营管理',
    '大数据与会计',
    '高速铁路客运服务',
    '酒店管理与数字化运营',
    '铁道交通运营管理',
    '铁路物流管理',
    '铁路物流管理（多式联运）',
  ],
  '智能制造学院': [
    '电气自动化技术',
    '机电一体化技术',
    '机械制造及自动化',
    '数字化设计与制造技术',
    '智能控制技术',
  ],
} as const;

export const COLLEGE_OPTIONS = Object.keys(COLLEGE_MAJOR_OPTIONS) as Array<keyof typeof COLLEGE_MAJOR_OPTIONS>;
export const MAJOR_OPTIONS = Object.values(COLLEGE_MAJOR_OPTIONS).flat();

export function collegeForMajor(major: string) {
  return COLLEGE_OPTIONS.find((college) => (COLLEGE_MAJOR_OPTIONS[college] as readonly string[]).includes(major)) || '';
}

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
  college?: string;
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
  activity_summary?: {
    word?: ActivitySummary | null;
    speaking?: ActivitySummary | null;
  };
};

export type ActivitySummary = {
  attempts: number;
  average_score: number;
  best_score: number;
  last_submitted_at: number;
};
