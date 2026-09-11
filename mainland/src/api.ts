export const CLOUDBASE_API_URL = 'https://cloudbase-d3gxxe4l88c3d5907-1431364187.ap-shanghai.app.tcloudbase.com/speakingLabApi';

const TOKEN_KEY = 'july-speaking-lab.teacher-token';
const siteBase = import.meta.env.BASE_URL.replace(/\/$/, '');

export function sitePath(path = '') {
  const normalized = path.replace(/^\/+|\/+$/g, '');
  return `${siteBase}/${normalized}${normalized ? '/' : ''}`;
}

export function getTeacherToken() {
  return window.sessionStorage.getItem(TOKEN_KEY) || '';
}

export function setTeacherToken(token: string) {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearTeacherToken() {
  window.sessionStorage.removeItem(TOKEN_KEY);
}

export async function cloudbaseRequest<T>(action: string, data: Record<string, unknown> = {}, token = '') {
  const response = await fetch(CLOUDBASE_API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, token, ...data }),
  });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'request failed');
  return payload;
}
