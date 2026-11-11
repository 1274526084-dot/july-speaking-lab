const SHARED_KEY = 'july-speaking-lab.teacher-session.v1';
const SESSION_MS = 8 * 60 * 60 * 1000;
export const HUB_TEACHER_KEY = 'july-english-hub.teacher-name';
export const TEACHER_TOKEN_KEY = 'july-speaking-lab.teacher-token';
export const PROFILE_TEACHER_TOKEN_KEY = 'july-english-profile.teacher-token';
export const WORD_TOKEN_KEY = 'july-word-lab.staff-token';
export const WORD_ROLE_KEY = 'july-word-lab.staff-role';

type TeacherSession = {
  teacherToken: string;
  wordToken: string;
  profileToken?: string;
  code: string;
  name: string;
  expiresAt: number;
};

function parseTeacherSession(raw: string | null): TeacherSession | null {
  try {
    const value = JSON.parse(raw || 'null');
    return value && typeof value.expiresAt === 'number' &&
      /^[a-f0-9]{64}$/i.test(value.teacherToken) && /^[a-f0-9]{64}$/i.test(value.wordToken) &&
      typeof value.code === 'string' && typeof value.name === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}

export function getTeacherSession(): TeacherSession | null {
  let shared = '';
  try {
    shared = window.localStorage.getItem(SHARED_KEY) || '';
  } catch {
    // Some embedded browsers allow only tab storage.
  }
  try {
    const value = parseTeacherSession(shared || window.sessionStorage.getItem(SHARED_KEY));
    return value && value.expiresAt > Date.now() ? value : null;
  } catch {
    return null;
  }
}

function clearLegacyTeacherSession() {
  const tab = window.sessionStorage;
  tab.removeItem(TEACHER_TOKEN_KEY);
  tab.removeItem(PROFILE_TEACHER_TOKEN_KEY);
  tab.removeItem(HUB_TEACHER_KEY);
  if (tab.getItem(WORD_ROLE_KEY) === 'teacher') {
    tab.removeItem(WORD_TOKEN_KEY);
    tab.removeItem(WORD_ROLE_KEY);
  }
}

export function rememberTeacherSession(value: Omit<TeacherSession, 'expiresAt'>, issuedAt: number) {
  clearLegacyTeacherSession();
  saveTeacherSession({ ...value, expiresAt: issuedAt + SESSION_MS });
}

function saveTeacherSession(value: TeacherSession) {
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(SHARED_KEY, raw);
    window.sessionStorage.removeItem(SHARED_KEY);
  } catch {
    window.sessionStorage.setItem(SHARED_KEY, raw);
  }
}

export function clearSharedProfileToken() {
  const shared = getTeacherSession();
  if (shared?.profileToken) saveTeacherSession({ ...shared, profileToken: undefined });
}

export function clearTeacherSession() {
  clearLegacyTeacherSession();
  window.sessionStorage.removeItem(SHARED_KEY);
  try {
    window.localStorage.removeItem(SHARED_KEY);
  } catch {
    // A tab-only session has already been removed.
  }
}

export function followTeacherSessionChanges() {
  window.addEventListener('storage', (event) => {
    if (event.key !== SHARED_KEY && event.key !== null) return;
    const before = parseTeacherSession(event.oldValue);
    const after = parseTeacherSession(event.newValue);
    if (event.key !== null && before?.teacherToken === after?.teacherToken && before?.wordToken === after?.wordToken) return;
    clearLegacyTeacherSession();
    window.sessionStorage.removeItem(SHARED_KEY);
    window.location.reload();
  });
}
