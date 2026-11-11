import { CLOUDBASE_API_URL, getTeacherToken, sitePath } from './api';
import { getProfileTeacherToken, PROFILE_API_URL } from './profile-api';
import { clearTeacherSession } from './teacher-session';
import { getWordToken, WORD_API_URL, wordPath } from './word-api';

export function wordTeacherPath(add = false) {
  return wordPath('teacher') + (add ? '?action=add' : '');
}

export function wordTeacherLoginPath(add = false) {
  const params = new URLSearchParams({ next: 'words/teacher' });
  if (add) params.set('action', 'add');
  return `${sitePath('workbench/login')}?${params}`;
}

export function signOutTeacher() {
  const credentials = [
    { url: CLOUDBASE_API_URL, token: getTeacherToken() },
    { url: WORD_API_URL, token: getWordToken() },
    { url: PROFILE_API_URL, token: getProfileTeacherToken() },
  ];
  clearTeacherSession();
  void Promise.allSettled(credentials.filter(({ token }) => token).map(({ url, token }) =>
    fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'logout', token }),
      keepalive: true,
    }),
  ));
}
