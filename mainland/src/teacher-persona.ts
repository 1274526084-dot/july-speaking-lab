const TEACHER_CODES = new Set(['july', 'cherie', 'lisa', 'alice']);

export function teacherCode(value?: string | null): string {
  const code = String(value || '').trim().toLowerCase();
  return TEACHER_CODES.has(code) ? code : 'july';
}

export function teacherPortrait(value?: string | null): string {
  return `${import.meta.env.BASE_URL}teachers/${teacherCode(value)}.webp`;
}

export function teacherBanner(value?: string | null): string {
  return `${import.meta.env.BASE_URL}teachers/${teacherCode(value)}-banner.webp`;
}
