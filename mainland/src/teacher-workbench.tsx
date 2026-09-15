import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  ClipboardCopy,
  ExternalLink,
  Headphones,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MessageCircleMore,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { clearTeacherToken, cloudbaseRequest, getTeacherToken, setTeacherToken, sitePath } from './api';
import { clearProfileTeacherToken, getProfileTeacherToken, profilePath, profileRequest, setProfileTeacherToken } from './profile-api';
import { clearWordSession, getWordToken, setWordSession, wordPath, wordRequest } from './word-api';

const HUB_TEACHER_KEY = 'july-english-hub.teacher-name';

type LoginResult = { ok?: boolean; token?: string; role?: string; name?: string };

export function TeacherWorkbenchLogin() {
  const [code, setCode] = useState('july');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getTeacherToken() && getWordToken() && (code !== 'july' || getProfileTeacherToken())) {
      window.location.replace(sitePath('workbench'));
    }
  }, [code]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !code || !password) return;
    setLoading(true); setError('');
    try {
      const [speaking, word] = await Promise.all([
        cloudbaseRequest<LoginResult>('teacherLogin', { code, password }),
        wordRequest<LoginResult>('login', { mode: 'teacher', code, password }),
      ]);
      if (!speaking.token || !word.token) throw new Error('教师账号或密码不正确。');
      setTeacherToken(speaking.token);
      setWordSession(word.token, word.role || 'teacher');
      if (code.toLowerCase() === 'july') {
        const profile = await profileRequest<LoginResult>('teacherLogin', { code, password });
        if (!profile.token) throw new Error('学情档案登录失败，请重试。');
        setProfileTeacherToken(profile.token);
      } else {
        clearProfileTeacherToken();
      }
      window.sessionStorage.setItem(HUB_TEACHER_KEY, speaking.name || code);
      window.location.replace(sitePath('workbench'));
    } catch (requestError) {
      clearTeacherToken(); clearWordSession(); clearProfileTeacherToken();
      setError(requestError instanceof Error ? requestError.message : '暂时无法登录，请检查网络后重试。');
    } finally { setLoading(false); }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#ffe2cf,transparent_32rem),radial-gradient(circle_at_bottom_right,#dfeeda,transparent_30rem),#fffaf5] px-5 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-[32px] border border-[#e5c9b3] bg-white shadow-[0_28px_80px_rgba(75,47,28,.13)]">
        <div className="bg-gradient-to-br from-[#fff0e5] to-[#eff7eb] px-7 py-8 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#416b36] text-white shadow-lg"><LockKeyhole className="h-8 w-8" /></span>
          <p className="mt-5 text-xs font-black tracking-[.18em] text-[#d8520c]">JULY ENGLISH DATA CENTER</p>
          <h1 className="serif mt-2 text-3xl font-bold">教师统一登录</h1>
          <p className="mt-3 leading-7 text-[#687168]">登录一次，分别查看学期主线数据和各单元活动数据。</p>
        </div>
        <form onSubmit={submit} className="space-y-5 px-7 py-7">
          <label className="grid gap-2 text-sm font-bold"><span>教师账号</span><span className="relative block"><UserRound className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#7c857b]" /><select value={code} onChange={(event) => setCode(event.target.value)} className="focus-ring h-13 w-full appearance-none rounded-2xl border border-[#d9c4b2] bg-[#fffaf6] pl-12 pr-4"><option value="cherie">Cherie</option><option value="lisa">Lisa</option><option value="alice">Alice</option><option value="july">July</option></select></span></label>
          <label className="grid gap-2 text-sm font-bold"><span>密码</span><span className="relative block"><KeyRound className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#7c857b]" /><input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" className="focus-ring h-13 w-full rounded-2xl border border-[#d9c4b2] bg-[#fffaf6] pl-12 pr-4" /></span></label>
          {error && <p role="alert" className="rounded-2xl bg-[#fff0e8] px-4 py-3 text-sm font-bold leading-6 text-[#b43f09]">{error}</p>}
          <button disabled={loading || !password} className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-[#416b36] px-5 py-3.5 font-black text-white disabled:opacity-55">{loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}{loading ? '正在连接三个数据端…' : '进入统一数据中心'}</button>
          <a href={sitePath()} className="block py-2 text-center text-sm font-bold text-[#24758d]">返回学生学习平台</a>
        </form>
      </section>
    </main>
  );
}

const dataLinks = [
  { title: '综合英语画像', description: '学期数据：查看学生起点、学习目标、班级统计及持续更新的综合成长画像。', href: profilePath('teacher'), icon: UsersRound, color: 'bg-[#e95a0d]', julyOnly: true },
  { title: '每课单词跟读数据', description: '学期数据：按教师、单元和班级查看每课跟读记录、系统评分、自评及录音。', href: wordPath('teacher'), icon: Headphones, color: 'bg-[#514bcf]' },
  { title: 'Unit 1 · 校园情景口语', description: '单元数据：按班级查看第一课情景对话、识别文字、评分与完整录音。', href: sitePath('teacher'), icon: MessageCircleMore, color: 'bg-[#416b36]' },
];

const studentLinks = [
  { title: '学生统一学习平台', href: sitePath(), note: '三个学生入口总览' },
  { title: '学生学情调查', href: profilePath(), note: '建立英语学习档案' },
  { title: '学生每课单词跟读', href: wordPath(), note: '贯穿学期，需教师发布对应单元' },
  { title: 'Unit 1 学生情景口语', href: sitePath('student'), note: '第一课四个校园场景' },
];

export function TeacherWorkbench() {
  const [copied, setCopied] = useState('');
  const teacherName = window.sessionStorage.getItem(HUB_TEACHER_KEY) || 'Teacher';
  const ready = Boolean(getTeacherToken() && getWordToken());

  useEffect(() => {
    if (!ready) window.location.replace(sitePath('workbench/login'));
  }, [ready]);

  if (!ready) return null;

  async function copyUrl(label: string, href: string) {
    const url = new URL(href, window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setCopied(label); window.setTimeout(() => setCopied(''), 1600); }
    catch { window.prompt('复制这个网址：', url); }
  }

  function logout() {
    clearTeacherToken(); clearWordSession(); clearProfileTeacherToken(); window.sessionStorage.removeItem(HUB_TEACHER_KEY);
    window.location.replace(sitePath('workbench/login'));
  }

  return (
    <main className="min-h-screen bg-[#f7f5f1] text-[#29342a]">
      <header className="border-b border-[#e2d7cd] bg-white px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5"><div><p className="text-xs font-black tracking-[.16em] text-[#d9520d]">JULY ENGLISH DATA CENTER</p><h1 className="serif mt-1 text-2xl font-bold sm:text-3xl">教师课堂数据中心</h1><p className="mt-1 text-sm text-[#6b746b]">{teacherName}老师 · 学期主线与单元活动分区查看</p></div><button type="button" onClick={logout} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-[#d7c9bd] px-4 py-2.5 font-bold text-[#657064]"><LogOut className="h-5 w-5" /><span className="hidden sm:inline">退出</span></button></div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="rounded-[28px] bg-gradient-to-r from-[#374f36] to-[#587b47] p-6 text-white shadow-xl shadow-green-950/10 sm:flex sm:items-center sm:justify-between sm:p-8"><div><div className="flex items-center gap-2 text-sm font-bold text-green-100"><BarChart3 className="h-5 w-5" />上课电脑快捷入口</div><h2 className="mt-2 text-2xl font-black sm:text-3xl">学期数据在前，当前单元活动在后</h2><p className="mt-3 max-w-3xl leading-7 text-green-50/85">学情档案与每课单词跟读贯穿全学期；校园情景口语归入 Unit 1。综合画像只读各模块结果，不改变练习网页和原始记录。</p></div><BookOpenCheck className="mt-6 h-16 w-16 shrink-0 text-green-100/70 sm:mt-0" /></section>

        <section className="mt-9">
          <div className="mb-4"><p className="text-xs font-black tracking-[.16em] text-[#d9520d]">01 · SEMESTER DATA</p><h2 className="mt-1 text-2xl font-black">学期主线数据</h2></div>
          <div className="grid gap-5 lg:grid-cols-2">
            {dataLinks.slice(0, 2).map(({ title, description, href, icon: Icon, color, julyOnly }) => {
              const unavailable = Boolean(julyOnly && teacherName.toLowerCase() !== 'july');
              return <a key={title} href={unavailable ? undefined : href} aria-disabled={unavailable} className={`group flex min-h-[225px] flex-col rounded-[26px] border border-[#e2d5ca] bg-white p-6 shadow-sm transition ${unavailable ? 'cursor-not-allowed opacity-55' : 'hover:-translate-y-1 hover:shadow-lg'}`}><div className="flex items-start justify-between"><span className={`grid h-13 w-13 place-items-center rounded-2xl ${color} text-white`}><Icon className="h-6 w-6" /></span><ExternalLink className="h-5 w-5 text-[#9b9f99] transition group-hover:translate-x-1" /></div><h3 className="mt-6 text-xl font-black">{title}</h3><p className="mt-3 flex-1 leading-7 text-[#697269]">{description}</p><strong className="mt-4 inline-flex items-center gap-2 text-[#d9520d]">{unavailable ? '仅July账号可查看' : '点击进入'}<ArrowRight className="h-4 w-4" /></strong></a>;
            })}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4"><p className="text-xs font-black tracking-[.16em] text-[#514bcf]">02 · UNIT DATA</p><h2 className="mt-1 text-2xl font-black">分单元活动数据</h2></div>
          <div className="grid gap-5 lg:grid-cols-3">
            {dataLinks.slice(2).map(({ title, description, href, icon: Icon, color }) => <a key={title} href={href} className="group flex min-h-[225px] flex-col rounded-[26px] border border-[#e2d5ca] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><div className="flex items-start justify-between"><span className={`grid h-13 w-13 place-items-center rounded-2xl ${color} text-white`}><Icon className="h-6 w-6" /></span><ExternalLink className="h-5 w-5 text-[#9b9f99] transition group-hover:translate-x-1" /></div><h3 className="mt-6 text-xl font-black">{title}</h3><p className="mt-3 flex-1 leading-7 text-[#697269]">{description}</p><strong className="mt-4 inline-flex items-center gap-2 text-[#d9520d]">点击进入<ArrowRight className="h-4 w-4" /></strong></a>)}
            {['Unit 2', 'Unit 3'].map((unit) => <article key={unit} className="flex min-h-[225px] flex-col rounded-[26px] border border-dashed border-[#d8cec5] bg-white/55 p-6 text-[#777e77]"><span className="grid h-13 w-13 place-items-center rounded-2xl bg-[#ece9e6]"><LockKeyhole className="h-6 w-6" /></span><h3 className="mt-6 text-xl font-black text-[#5d655e]">{unit} · 待发布</h3><p className="mt-3 leading-7">后续课程活动及对应教师数据入口将在这里增加。</p></article>)}
          </div>
        </section>

        <section className="mt-10 rounded-[28px] border border-[#e2d6cc] bg-white p-6 sm:p-8">
          <div className="flex items-center gap-3"><ClipboardCopy className="h-6 w-6 text-[#e25913]" /><div><h2 className="text-xl font-black">学生入口网址集合</h2><p className="mt-1 text-sm text-[#707970]">课堂投屏可直接点击，也可以复制后发到学习通。</p></div></div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {studentLinks.map((item) => <div key={item.title} className="flex items-center gap-3 rounded-2xl border border-[#e7ddd5] bg-[#fffaf6] p-4"><a href={item.href} className="min-w-0 flex-1"><strong className="block text-[#334035]">{item.title}</strong><span className="mt-1 block truncate text-sm text-[#788078]">{item.note}</span></a><button type="button" onClick={() => void copyUrl(item.title, item.href)} className="focus-ring shrink-0 rounded-xl border border-[#d9c8ba] bg-white px-3 py-2 text-sm font-bold text-[#416b36]">{copied === item.title ? '已复制' : '复制网址'}</button></div>)}
          </div>
        </section>
        <p className="mt-8 text-center text-sm text-[#858b84]">教师登录状态保留8小时；在公共电脑使用后请点击右上角退出。</p>
      </div>
    </main>
  );
}
