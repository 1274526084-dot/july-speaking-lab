import { deleteTeacherSession, json } from '../_shared.js';

export async function onRequestPost({ request }) {
  const cookie = await deleteTeacherSession(request);
  return json({ ok: true }, 200, { 'set-cookie': cookie });
}

export function onRequest() {
  return json({ ok: false, error: 'Method not allowed' }, 405, { allow: 'POST' });
}
