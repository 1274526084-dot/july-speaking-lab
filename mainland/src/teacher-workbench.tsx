import {
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { type SyntheticEvent, useEffect, useState } from 'react';
import { CourseBoard } from './course-board';
import {
  TaskComposer,
  type ArchiveTask as EditableTask,
} from './archive-teacher';
import { CLASS_CATALOG } from '@/lib/class-catalog';
import { ClassroomAccess } from './classroom-access';
import {
  clearTeacherToken,
  cloudbaseRequest,
  getTeacherToken,
  setTeacherToken,
  sitePath,
} from './api';
import {
  clearProfileTeacherToken,
  getProfileTeacherToken,
  profilePath,
  profileRequest,
  setProfileTeacherToken,
} from './profile-api';
import {
  clearWordSession,
  getWordToken,
  setWordSession,
  wordPath,
  wordRequest,
} from './word-api';

const HUB_TEACHER_KEY = 'july-english-hub.teacher-name';

type LoginResult = {
  ok?: boolean;
  token?: string;
  role?: string;
  name?: string;
};

export function TeacherWorkbenchLogin() {
  const destination =
    new URLSearchParams(window.location.search).get('next') ===
    'archive/teacher'
      ? sitePath('archive/teacher')
      : sitePath('workbench');
  const [code, setCode] = useState('july');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (
      getTeacherToken() &&
      (destination === sitePath('archive/teacher') ||
        (getWordToken() && (code !== 'july' || getProfileTeacherToken())))
    ) {
      window.location.replace(destination);
    }
  }, [code, destination]);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !code || !password) return;
    setLoading(true);
    setError('');
    try {
      if (destination === sitePath('archive/teacher')) {
        const teacher = await cloudbaseRequest<LoginResult>('teacherLogin', {
          code,
          password,
        });
        if (!teacher.token) throw new Error('教师账号或密码不正确。');
        setTeacherToken(teacher.token);
        window.sessionStorage.setItem(HUB_TEACHER_KEY, teacher.name || code);
        window.location.replace(destination);
        return;
      }
      const [speaking, word] = await Promise.all([
        cloudbaseRequest<LoginResult>('teacherLogin', { code, password }),
        wordRequest<LoginResult>('login', { mode: 'teacher', code, password }),
      ]);
      if (!speaking.token || !word.token)
        throw new Error('教师账号或密码不正确。');
      setTeacherToken(speaking.token);
      setWordSession(word.token, word.role || 'teacher');
      if (code.toLowerCase() === 'july') {
        const profile = await profileRequest<LoginResult>('teacherLogin', {
          code,
          password,
        });
        if (!profile.token) throw new Error('学情档案登录失败，请重试。');
        setProfileTeacherToken(profile.token);
      } else {
        clearProfileTeacherToken();
      }
      window.sessionStorage.setItem(HUB_TEACHER_KEY, speaking.name || code);
      window.location.replace(destination);
    } catch (requestError) {
      clearTeacherToken();
      clearWordSession();
      clearProfileTeacherToken();
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
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#ffe2cf,transparent_32rem),radial-gradient(circle_at_bottom_right,#dfeeda,transparent_30rem),#fffaf5] px-5 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-[32px] border border-[#e5c9b3] bg-white shadow-[0_28px_80px_rgba(75,47,28,.13)]">
        <div className="bg-gradient-to-br from-[#fff0e5] to-[#eff7eb] px-7 py-8 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-[#416b36] text-white shadow-lg">
            <LockKeyhole className="h-8 w-8" />
          </span>
          <p className="mt-5 text-xs font-black tracking-[.18em] text-[#d8520c]">
            JULY ENGLISH DATA CENTER
          </p>
          <h1 className="serif mt-2 text-3xl font-bold">教师统一登录</h1>
          <p className="mt-3 leading-7 text-[#687168]">
            登录一次，分别查看学期主线数据和各单元活动数据。
          </p>
        </div>
        <form onSubmit={submit} className="space-y-5 px-7 py-7">
          <label className="grid gap-2 text-sm font-bold">
            <span>教师账号</span>
            <span className="relative block">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#7c857b]" />
              <select
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="focus-ring h-13 w-full appearance-none rounded-2xl border border-[#d9c4b2] bg-[#fffaf6] pl-12 pr-4"
              >
                <option value="cherie">Cherie</option>
                <option value="lisa">Lisa</option>
                <option value="alice">Alice</option>
                <option value="july">July</option>
              </select>
            </span>
          </label>
          <label className="grid gap-2 text-sm font-bold">
            <span>密码</span>
            <span className="relative block">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-[#7c857b]" />
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入密码"
                className="focus-ring h-13 w-full rounded-2xl border border-[#d9c4b2] bg-[#fffaf6] pl-12 pr-4"
              />
            </span>
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-2xl bg-[#fff0e8] px-4 py-3 text-sm font-bold leading-6 text-[#b43f09]"
            >
              {error}
            </p>
          )}
          <button
            disabled={loading || !password}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-[#416b36] px-5 py-3.5 font-black text-white disabled:opacity-55"
          >
            {loading ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <ShieldCheck className="h-5 w-5" />
            )}
            {loading ? '正在连接三个数据端…' : '进入统一数据中心'}
          </button>
          <a
            href={sitePath()}
            className="block py-2 text-center text-sm font-bold text-[#24758d]"
          >
            返回学生学习平台
          </a>
        </form>
      </section>
    </main>
  );
}

export function TeacherWorkbench() {
  const teacherName = sessionStorage.getItem(HUB_TEACHER_KEY) || 'Teacher';
  const ready = Boolean(getTeacherToken() && getWordToken());
  const [editor, setEditor] = useState<EditableTask | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!ready) location.replace(sitePath('workbench/login'));
  }, [ready]);
  if (!ready) return null;
  function logout() {
    clearTeacherToken();
    clearWordSession();
    clearProfileTeacherToken();
    sessionStorage.removeItem(HUB_TEACHER_KEY);
    location.replace(sitePath('workbench/login'));
  }
  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#2d4234] sm:px-7">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-xs font-bold tracking-widest text-[#8a957e]">
              {teacherName} · RAILWAY ENGLISH
            </p>
            <h1 className="mt-1 text-2xl font-bold">教师课堂工作台</h1>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-xl border border-[#d4ddcb] bg-white px-4 py-2 text-sm"
          >
            <LogOut size={16} />
            退出
          </button>
        </header>
        <ClassroomAccess />
        <nav
          aria-label="教师快捷入口"
          className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {[
            { title: '班级档案', href: sitePath('archive/teacher') },
            { title: '单词与录音', href: wordPath('teacher') },
            { title: '口语与录音', href: sitePath('teacher') },
            { title: '学生学习入口', href: sitePath() },
          ].map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="rounded-2xl border border-[#dde5d5] bg-white p-4 text-center text-sm font-bold"
            >
              {item.title}
            </a>
          ))}
        </nav>
        <CourseBoard
          revision={revision}
          teacher
          onTask={(unit, lesson, task) =>
            setEditor(
              task
                ? (task as unknown as EditableTask)
                : {
                    title: '',
                    unit: 'Unit ' + unit,
                    lesson: 'Lesson ' + lesson,
                    type: 'link',
                    description: '',
                    href: '',
                    classes: [],
                    dueAt: null,
                    status: 'draft',
                    questions: [],
                  },
            )
          }
        />
        <details className="my-6 rounded-2xl border border-[#dde5d5] bg-white p-4 text-sm">
          <summary className="cursor-pointer font-bold">
            更多数据与上课入口
          </summary>
          <div className="mt-4 flex flex-wrap gap-4">
            {teacherName.toLowerCase() === 'july' && (
              <a href={profilePath('teacher')}>学情统计 →</a>
            )}
            <a href={sitePath('archive/teacher') + '?tab=unit2'}>
              Unit 1 · 第2课作答明细 →
            </a>
            <button
              onClick={() =>
                void navigator.clipboard
                  .writeText(new URL(sitePath(), location.origin).href)
                  .catch(() =>
                    window.prompt(
                      '复制学生入口',
                      new URL(sitePath(), location.origin).href,
                    ),
                  )
              }
            >
              复制学生入口
            </button>
          </div>
        </details>
        {editor && (
          <TaskComposer
            initial={editor}
            classes={[...CLASS_CATALOG]}
            onClose={() => setEditor(null)}
            onSaved={async () => {
              setEditor(null);
              setRevision((value) => value + 1);
            }}
          />
        )}
      </div>
    </main>
  );
}
