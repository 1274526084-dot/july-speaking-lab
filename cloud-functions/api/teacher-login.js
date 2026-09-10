import { createTeacherSession, json, loginIsBlocked, loginRateState, passwordMatches } from '../_shared.js';

export async function onRequestPost({ request, env }) {
  if (await loginIsBlocked(request)) {
    return json({ ok: false, error: '尝试次数过多，请15分钟后再试。' }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: '登录信息无法读取。' }, 400);
  }

  const valid = passwordMatches(body?.password, env || {});
  const rate = await loginRateState(request, valid);
  if (!valid) {
    const error = rate.blocked ? '尝试次数过多，请15分钟后再试。' : '密码不正确，请重试。';
    return json({ ok: false, error }, rate.blocked ? 429 : 401);
  }

  const session = await createTeacherSession();
  return json({ ok: true }, 200, { 'set-cookie': session.cookie });
}

export function onRequest() {
  return json({ ok: false, error: 'Method not allowed' }, 405, { allow: 'POST' });
}
