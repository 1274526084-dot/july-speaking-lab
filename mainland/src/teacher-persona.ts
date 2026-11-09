export const TEACHER_OPTIONS = [
  { code: 'cherie', label: 'Cherie' },
  { code: 'lisa', label: 'Lisa' },
  { code: 'alice', label: 'Alice' },
  { code: 'zhai', label: 'Zhai · 翟雪丽' },
  { code: 'july', label: 'July' },
];
const TEACHER_CODES = new Set(TEACHER_OPTIONS.map(option => option.code));

export function teacherCode(value?: string | null): string {
  const code = String(value || '').trim().toLowerCase().split('·')[0].trim();
  return TEACHER_CODES.has(code) ? code : 'july';
}

export function teacherPortrait(value?: string | null): string {
  return `${import.meta.env.BASE_URL}teachers/${teacherCode(value)}.webp`;
}

export function teacherBanner(value?: string | null): string {
  return `${import.meta.env.BASE_URL}teachers/${teacherCode(value)}-banner.webp`;
}
