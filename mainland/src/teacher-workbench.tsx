import {
  KeyRound,
  Headphones,
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
import { ArchiveError, archiveRequest } from './archive-api';
import {
  cloudbaseRequest,
  getTeacherToken,
  sitePath,
} from './api';
import {
  profilePath,
  profileRequest,
} from './profile-api';
import { getWordToken, setWordSession, wordPath, wordRequest } from './word-api';
import { signOutTeacher, wordTeacherPath } from './teacher-access';
import { clearTeacherSession, getTeacherSession, rememberTeacherSession } from './teacher-session';
import { TEACHER_OPTIONS, teacherPortrait } from './teacher-persona';

type LoginResult = {
  ok?: boolean;
  token?: string;
  role?: string;
  name?: string;
};

export function TeacherWorkbenchLogin() {
  const params = new URLSearchParams(window.location.search);
  const archiveDestination = params.get('next') === 'archive/teacher';
  const wordDestination = params.get('next') === 'words/teacher';
  const taskId = params.get('task');
  const destination = archiveDestination
    ? `${sitePath('archive/teacher')}${taskId ? `?${new URLSearchParams({ task: taskId })}` : ''}`
    : wordDestination ? wordTeacherPath(params.get('action') === 'add') : sitePath('workbench');
  const [code, setCode] = useState('july');
  const [otherCode, setOtherCode] = useState('');
  const wordOnly = wordDestination && code === 'other';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getTeacherSession() || (archiveDestination && getTeacherToken()) || (wordDestination && getWordToken())) {
      window.location.replace(destination);
    }
  }, [destination, archiveDestination, wordDestination]);

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !code || !password || (wordOnly && !otherCode.trim())) return;
    setLoading(true);
    setError('');
    try {
      if (wordOnly) {
        const word = await wordRequest<LoginResult>('login', { mode: 'teacher', code: otherCode.trim(), password });
        if (!word.token || word.role !== 'teacher') throw new Error('教师账号或密码不正确。');
        setWordSession(word.token, word.role);
        window.location.replace(destination);
        return;
      }
      const issuedAt = Date.now();
      const [speaking, word] = await Promise.all([
        cloudbaseRequest<LoginResult>('teacherLogin', { code, password }),
        wordRequest<LoginResult>('login', { mode: 'teacher', code, password }),
      ]);
      if (!speaking.token || !word.token || word.role !== 'teacher')
        throw new Error('教师账号或密码不正确。');
      const profile = code === 'july'
        ? await profileRequest<LoginResult>('teacherLogin', { code, password }).catch(() => null)
        : null;
      rememberTeacherSession({
        teacherToken: speaking.token,
        wordToken: word.token,
        profileToken: profile?.token,
        code,
        name: speaking.name || word.name || code,
      }, issuedAt);
      window.location.replace(destination);
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
            登录一次，即可在课堂工作台和单词跟读管理之间切换。
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
                {TEACHER_OPTIONS.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
                {wordDestination && <option value="other">其他单词跟读账号</option>}
              </select>
            </span>
          </label>
          {wordOnly && (
            <label className="grid gap-2 text-sm font-bold">
              单词跟读教师代码
              <input required value={otherCode} onChange={(event) => setOtherCode(event.target.value)} autoComplete="username"
                className="focus-ring h-13 rounded-2xl border border-[#d9c4b2] bg-[#fffaf6] px-4" />
            </label>
          )}
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
            disabled={loading || !password || (wordOnly && !otherCode.trim())}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-2xl bg-[#416b36] px-5 py-3.5 font-black text-white disabled:opacity-55"
          >
            {loading ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <ShieldCheck className="h-5 w-5" />
            )}
            {loading ? '正在验证…' : wordDestination ? '进入单词跟读管理' : '进入教师工作台'}
          </button>
          <a
            href={sitePath()}
            className="block py-2 text-center text-sm font-bold text-[#24758d]"
          >
            返回学生学习平台
          </a>
          {wordDestination && <a href={wordPath('admin')} className="block text-center text-xs text-[#687168]">管理员入口</a>}
        </form>
      </section>
    </main>
  );
}

export function TeacherWorkbench() {
  const session = getTeacherSession();
  const teacherName = session?.name || 'Teacher';
  const teacherToken = session?.teacherToken || '';
  const [editor, setEditor] = useState<EditableTask | null>(null);
  const [revision, setRevision] = useState(0);
  const [teachingRole, setTeachingRole] = useState<{ assignedClasses: string[]; canManageCourse: boolean } | null>(null);
  useEffect(() => {
    if (!teacherToken) location.replace(sitePath('workbench/login'));
  }, [teacherToken]);
  useEffect(() => {
    if (!teacherToken) return;
    void archiveRequest<{ assignedClasses: string[]; canManageCourse: boolean }>('teacherSession', {}, teacherToken)
      .then(setTeachingRole).catch((error) => {
        if (error instanceof ArchiveError && error.status === 401 && getTeacherSession()?.teacherToken === teacherToken) {
          clearTeacherSession();
          location.replace(sitePath('workbench/login'));
        }
      });
  }, [teacherToken]);
  if (!session) return null;
  async function logout() {
    await signOutTeacher();
    location.replace(sitePath('workbench/login'));
  }
  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#2d4234] sm:px-7">
      <div className="mx-auto max-w-6xl">
        <header className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[26px] border border-[#d6e4d5] bg-gradient-to-r from-[#e8f3ec] via-[#fbfaf3] to-[#f6e9d8] p-5 shadow-[0_14px_36px_#254f3520] sm:p-7">
          <div className="flex items-center gap-4 sm:gap-6">
            <img src={teacherPortrait(teacherName)} alt={`${teacherName}老师的卡通形象`} className="h-24 w-24 object-cover mix-blend-multiply [mask-image:radial-gradient(ellipse_72%_76%_at_50%_45%,black_52%,transparent_100%)] sm:h-28 sm:w-28" />
            <div>
              <p className="text-xs font-bold tracking-widest text-[#90704b]">
                {teacherName} · RAILWAY ENGLISH
              </p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl">教师课堂工作台</h1>
              <p className="mt-1 text-sm text-[#557467]">我的班级 · 每课任务 · 学生成长</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-xl border border-[#d4ddcb] bg-white px-4 py-2 text-sm"
          >
            <LogOut size={16} />
            退出
          </button>
        </header>
        <section aria-label="单词跟读" className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#d6e4d5] bg-white p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e8f3ec] text-[#416b36]"><Headphones size={23} aria-hidden="true" /></span>
            <div><h2 className="font-bold">单词跟读</h2><p className="text-sm text-[#557467]">添加词汇、发布单元，查看学生跟读记录。</p></div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm font-bold">
            <a href={wordTeacherPath(true)} className="rounded-xl bg-[#416b36] px-4 py-2 text-white">添加词汇</a>
            <a href={wordTeacherPath()} className="rounded-xl border border-[#d4ddcb] px-4 py-2">管理单元</a>
            <a href={wordPath()} className="rounded-xl border border-[#d4ddcb] px-4 py-2">学生练习入口</a>
          </div>
        </section>
        <ClassroomAccess />
        <nav
          aria-label="教师快捷入口"
          className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {[
            { title: '班级档案', href: sitePath('archive/teacher') },
            { title: '每课任务与成绩', href: sitePath('archive/teacher') + '?tab=scores' },
            { title: '教师总览', href: sitePath('archive/teacher') + '?tab=overview' },
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
            <a href={sitePath('archive/teacher') + '?tab=scores'}>
              每课任务与成绩 →
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
            classes={teachingRole?.canManageCourse ? [...CLASS_CATALOG] : teachingRole?.assignedClasses || []}
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
