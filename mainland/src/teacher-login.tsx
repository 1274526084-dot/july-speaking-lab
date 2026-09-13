/* oxlint-disable next/no-html-link-for-pages */
import {
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { type SyntheticEvent, useEffect, useState } from 'react';
import {
  cloudbaseRequest,
  getTeacherToken,
  setTeacherToken,
  sitePath,
} from './api';

export function TeacherLogin() {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getTeacherToken();
    if (!token) return;
    void cloudbaseRequest<{ ok: boolean }>('session', {}, token)
      .then(() => window.location.replace(sitePath('teacher')))
      .catch(() => undefined);
  }, []);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code || !password || loading) return;
    setLoading(true);
    setError('');
    try {
      const payload = await cloudbaseRequest<{
        ok: boolean;
        token?: string;
        name?: string;
      }>('teacherLogin', { code, password });
      if (!payload.ok || !payload.token) {
        setError('教师账号或密码不正确，请重试。');
        return;
      }
      setTeacherToken(payload.token);
      window.location.replace(sitePath('teacher'));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : '暂时无法登录，请检查网络后重试。',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-[32px] border border-[#e4c8b1] bg-white shadow-soft">
        <div className="bg-gradient-to-br from-[#fff0e4] to-[#eef7ea] px-7 py-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#ea5a0b] text-white shadow-lg shadow-orange-900/10">
            <LockKeyhole className="h-8 w-8" />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-[#416b36]">
            July English Lab
          </p>
          <h1 className="serif mt-1 text-3xl font-bold text-[#d94f08]">
            教师数据登录
          </h1>
          <p className="mt-3 leading-7 text-[#687168]">
            四位教师独立登录，共同查看学生的录音、对话文本和评分。
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5 px-7 py-7">
          <label className="grid gap-2 text-sm font-bold text-[#59645a]">
            教师账号
            <span className="relative block">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#8b8179]" />
              <select
                required
                autoComplete="username"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="focus-ring h-13 w-full appearance-none rounded-2xl border border-[#d9c4b2] bg-[#fffaf6] pl-12 pr-10 text-base"
              >
                <option value="">请选择姓名</option>
                <option value="cherie">Cherie</option>
                <option value="lisa">Lisa</option>
                <option value="alice">Alice</option>
                <option value="july">July</option>
              </select>
            </span>
          </label>

          <label className="grid gap-2 text-sm font-bold text-[#59645a]">
            密码
            <span className="relative block">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8b8179]" />
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="focus-ring h-13 w-full rounded-2xl border border-[#d9c4b2] bg-[#fffaf6] pl-12 pr-4 text-base"
                placeholder="请输入密码"
              />
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-2xl bg-[#fff0ea] px-4 py-3 text-sm font-bold leading-6 text-[#b33d08]"
            >
              {error}
            </p>
          )}

          <button
            disabled={loading || !code || !password}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-[#416b36] px-5 py-3.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
          >
            {loading ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <ShieldCheck className="h-5 w-5" />
            )}
            {loading ? '正在验证…' : '进入教师数据端'}
          </button>

          <a
            href={sitePath('student')}
            className="focus-ring block rounded-xl py-2 text-center text-sm font-bold text-[#23748d]"
          >
            返回学生练习
          </a>
        </form>
      </section>
    </main>
  );
}
