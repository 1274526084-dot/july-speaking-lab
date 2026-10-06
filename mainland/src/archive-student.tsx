import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Headphones,
  Home,
  LogOut,
  Map,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  TrainFront,
  UserRound,
} from 'lucide-react';
import { StudentClassField } from '@/components/student-class-field';
import { sitePath } from './api';
import { SKILL_LABELS } from './profile-api';
import {
  ArchiveError,
  archiveRequest,
  clearArchiveToken,
  getArchiveToken,
  getPendingAccess,
  setArchiveToken,
  setPendingAccess,
  type AccessRequest,
  type ArchiveHistory,
  type ArchiveNews,
  type ArchiveTask,
  type StudentArchiveData,
} from './archive-api';
import { LearningAvatar, SkillRadar } from './archive-visuals';
import './archive-student.css';
import './archive-entry.css';
import {
  rememberCourseIdentity,
  rememberCourseStudent,
  getCourseIdentity,
  getCourseStudent,
  COURSE_SESSION_KEY,
  studentReturnUrl,
} from './course-session';
import { Unit2Panel } from './unit2-panel';
import { CourseBoard } from './course-board';

const skillKeys = Object.keys(SKILL_LABELS) as Array<keyof typeof SKILL_LABELS>;
const date = (value?: number | null) =>
  value ? new Date(value).toLocaleDateString('zh-CN') : '未设置';
const numberScore = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(value)}分`
    : '未评分';
const safeHref = (value?: string) => {
  try {
    const url = new URL(value || '', window.location.origin);
    return /^https?:$/.test(url.protocol) && value ? url.href : '';
  } catch {
    return '';
  }
};
const advice: Record<string, { title: string; steps: string; route: string }> =
  {
    listening: {
      title: '先练「听见关键信息」',
      steps: '选一段20秒站台广播，先听目的地，再听时间；第三遍对照文本。',
      route: '单词和听力任务',
    },
    speaking: {
      title: '从一句完整回答开始',
      steps:
        '先用句型回答，再补充一个理由。回听两次：有没有说完整？对方能否明白？',
      route: '校园口语任务',
    },
    reading: {
      title: '读懂一条铁路信息',
      steps: '用英文新闻或车站标识，圈出 who、where、when；不要逐词翻译。',
      route: '铁路英语窗',
    },
    writing: {
      title: '写出三句清楚的信息',
      steps: '尝试给同伴写一条出行通知：目的地、时间、需要准备什么。',
      route: '写作或小测任务',
    },
    vocabulary: {
      title: '让词汇进入专业场景',
      steps: '每次选5个词，听示范、跟读，再用其中2个词描述一个铁路场景。',
      route: '每课单词跟读',
    },
    grammar: {
      title: '在句子里检查语法',
      steps: '写一句工作安排，检查主语、动词和时间；再把它改成一个问句。',
      route: '教师发布的小测',
    },
    pronunciation: {
      title: '一次只改一个发音点',
      steps: '选一个词，比较示范和自己的录音，先注意重音，再注意词尾。',
      route: '每课单词跟读',
    },
  };

export function ArchiveStudent() {
  const [token, setToken] = useState(getArchiveToken);
  const [pending, setPending] = useState<AccessRequest | null>(
    getPendingAccess,
  );
  const [data, setData] = useState<StudentArchiveData | null>(null);
  const [feed, setFeed] = useState<{
    tasks: ArchiveTask[];
    news: ArchiveNews[];
  }>({ tasks: [], news: [] });
  const [name, setName] = useState(() => getCourseStudent()?.name || '');
  const [className, setClassName] = useState(
    () => getCourseStudent()?.className || '',
  );
  const [remember, setRemember] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('path');
  const [avatar, setAvatar] = useState<'explorer' | 'engineer'>(() =>
    localStorage.getItem('july.archive.avatar') === 'engineer'
      ? 'engineer'
      : 'explorer',
  );
  const [quiz, setQuiz] = useState<ArchiveTask | null>(null);
  const [reflection, setReflection] = useState(false);
  const [notice, setNotice] = useState('');
  const pendingBusy = useRef(false);
  const activeToken = useRef(token);
  useEffect(() => {
    activeToken.current = token;
  }, [token]);
  useEffect(() => {
    const syncIdentity = (event: StorageEvent) => {
      if (event.key !== COURSE_SESSION_KEY) return;
      const next = getArchiveToken();
      if (next === activeToken.current) return;
      activeToken.current = next;
      sessionStorage.removeItem('july.archive.student-session.v1');
      setData(null);
      setToken(next);
    };
    window.addEventListener('storage', syncIdentity);
    return () => window.removeEventListener('storage', syncIdentity);
  }, []);

  const load = useCallback(
    async (value = token) => {
      if (!value || activeToken.current !== value) return;
      setBusy(true);
      setError('');
      try {
        const result = await archiveRequest<StudentArchiveData>(
          'studentDashboard',
          { studentToken: value },
        );
        if (activeToken.current === value) {
          setData(result);
          if (getCourseIdentity()?.token !== value) {
            const ids = [
              ...new Set(
                result.history
                  .filter((row) => row.type === 'speaking')
                  .map(
                    (row) => (row.details as { studentId?: string })?.studentId,
                  )
                  .filter(Boolean),
              ),
            ];
            rememberCourseIdentity({
              token: value,
              student: {
                ...result.student,
                ...(ids.length === 1 ? { studentNumber: ids[0] } : {}),
              },
              expiresAt: Date.now() + 2 * 60 * 60 * 1000,
            });
          }
          const next = studentReturnUrl();
          if (next) window.location.replace(next);
        }
      } catch (err) {
        if (activeToken.current !== value) return;
        setError(
          err instanceof Error ? err.message : '暂时不能读取档案，请重试。',
        );
        if (err instanceof ArchiveError && err.status === 401) {
          clearArchiveToken();
          setToken('');
          setData(null);
        }
      } finally {
        if (activeToken.current === value) setBusy(false);
      }
    },
    [token],
  );

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (token) void load(token);
      else
        void archiveRequest<{ tasks: ArchiveTask[]; news: ArchiveNews[] }>(
          'publicFeed',
        )
          .then((result) => {
            if (active) setFeed(result);
          })
          .catch(() => {});
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [token, load]);
  useEffect(() => {
    if (!pending) return;
    let active = true;
    const poll = async () => {
      if (pendingBusy.current) return;
      pendingBusy.current = true;
      try {
        const result = await archiveRequest<{
          status: string;
          studentToken?: string;
          student?: { id: string; name: string; className: string };
          expiresAt?: number;
        }>('accessStatus', { requestToken: pending.requestToken });
        if (!active) return;
        if (result.status === 'approved' && result.studentToken) {
          setArchiveToken(result.studentToken, pending.remember);
          setPendingAccess(null);
          setPending(null);
          setToken(result.studentToken);
          setNotice('老师已确认，欢迎进入自己的学习档案。');
          const next = studentReturnUrl();
          if (next && result.student && result.expiresAt) {
            rememberCourseIdentity({
              token: result.studentToken,
              student: result.student,
              expiresAt: Math.min(
                result.expiresAt,
                Date.now() + 2 * 60 * 60 * 1000,
              ),
            });
            window.location.replace(next);
          }
        } else if (
          result.status === 'rejected' ||
          result.status === 'expired' ||
          result.status === 'revoked'
        ) {
          setError(
            result.status === 'rejected'
              ? '此次设备申请未通过，请和老师核对姓名、班级后重新申请。'
              : '此次设备申请已过期或被撤销，请重新申请。',
          );
          setPendingAccess(null);
          setPending(null);
        }
      } catch (err) {
        if (active)
          setError(
            err instanceof Error ? err.message : '连接失败，可稍后刷新确认。',
          );
      } finally {
        pendingBusy.current = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void poll();
    }, 5000);
    const visible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [pending]);

  useEffect(() => {
    if (
      !pending ||
      (pending.practiceToken && Number(pending.practiceExpiresAt) > Date.now())
    )
      return;
    let active = true;
    void archiveRequest<{
      practiceToken: string;
      practiceExpiresAt: number;
      student: { id: string; name: string; className: string };
    }>('startPractice', { requestToken: pending.requestToken })
      .then((result) => {
        if (!active) return;
        const next = { ...pending, ...result };
        setPendingAccess(next);
        setPending(next);
        rememberCourseIdentity({
          token: result.practiceToken,
          verified: false,
          student: result.student,
          expiresAt: result.practiceExpiresAt,
        });
        const back = studentReturnUrl();
        if (back) window.location.replace(back);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : '课堂身份暂未连接，请重试。',
          );
      });
    return () => {
      active = false;
    };
  }, [pending]);

  async function requestAccess(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent || busy) return;
    setBusy(true);
    setError('');
    try {
      rememberCourseStudent({ name: name.trim(), className: className.trim() });
      const result = await archiveRequest<AccessRequest>('requestAccess', {
        name: name.trim(),
        className: className.trim(),
        practice: true,
      });
      const request = {
        ...result,
        name: name.trim(),
        className: className.trim(),
        remember,
      };
      setPendingAccess(request);
      setPending(request);
      if (result.practiceToken && result.student && result.practiceExpiresAt) {
        rememberCourseIdentity({
          token: result.practiceToken,
          student: result.student,
          verified: false,
          expiresAt: result.practiceExpiresAt,
        });
        const next = studentReturnUrl();
        if (next) window.location.replace(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '申请失败，请重试。');
    } finally {
      setBusy(false);
    }
  }

  const snapshots = [...(data?.snapshots || [])].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  const skills = snapshots[0]?.skills || data?.profile?.skills;
  const previous =
    snapshots[1]?.skills ||
    (snapshots.length ? data?.profile?.skills : undefined);
  const weak = skills
    ? skillKeys
        .filter((key) => Number.isFinite(skills[key]))
        .sort((a, b) => skills[a] - skills[b])
        .slice(0, 2)
    : [];
  const records = [...(data?.history || [])].sort(
    (a, b) => b.submittedAt - a.submittedAt,
  );
  const tasks = data?.tasks || feed.tasks || [];
  const news = data?.news || feed.news || [];
  const wordRecords = records.filter((row) => row.type === 'word');
  const speakingRecords = records.filter((row) => row.type === 'speaking');
  const tabs = [
    { id: 'path', label: '课程与成绩', icon: Map },
    { id: 'portrait', label: '我的画像', icon: UserRound },
    { id: 'works', label: '作品与反馈', icon: Headphones },
    { id: 'news', label: '铁路英语窗', icon: TrainFront },
  ];

  function logout() {
    const current = token;
    activeToken.current = '';
    clearArchiveToken();
    setToken('');
    setData(null);
    setBusy(false);
    setQuiz(null);
    setReflection(false);
    setNotice('已退出此设备。原有学习记录仍保存在云端。');
    if (current)
      void archiveRequest('studentLogout', { studentToken: current }).catch(
        () =>
          setNotice(
            '已清除本机登录；暂时无法连接云端撤销凭证。若手机丢失，请老师从设备列表撤销。',
          ),
      );
  }
  const openTask = (task: ArchiveTask) => {
    if (task.type === 'quiz') {
      setQuiz(task);
    } else if (safeHref(task.href))
      window.open(safeHref(task.href), '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="archive-student">
      <header className="archive-top">
        <a className="archive-brand" href={sitePath()}>
          <span>
            <TrainFront size={27} />
          </span>
          <div>
            <small>JULY · RAILWAY ENGLISH</small>
            <strong>铁路英语学习档案</strong>
          </div>
        </a>
        <div className="archive-top-actions">
          <a href={sitePath()}>
            <Home size={17} />
            学习平台
          </a>
          {token ? (
            <button onClick={logout}>
              <LogOut size={16} />
              退出本机
            </button>
          ) : (
            <a href={sitePath('workbench/login')}>
              教师入口 <ArrowRight size={16} />
            </a>
          )}
        </div>
      </header>
      {error && (
        <div role="alert" className="archive-alert">
          <p>{error}</p>
          {token && (
            <button disabled={busy} onClick={() => void load()}>
              重新加载
            </button>
          )}
        </div>
      )}
      {notice && (
        <output className="archive-notice" style={{ display: 'block' }}>
          {notice}
        </output>
      )}
      {!token && !pending?.practiceToken && (
        <div className="archive-welcome archive-rail-entry">
          <section className="archive-rail-story">
            <div className="archive-rail-heading">
              <span className="archive-eyebrow">
                RAILWAY ENGLISH · 学习旅程
              </span>
              <h1>
                下一站，
                <br />
                更好的英语。
              </h1>
              <p>从校园出发，与铁路世界对话。</p>
            </div>
            <figure className="archive-rail-illustration">
              {/* Fictional illustration, not a photograph of the college or its students. */}
              {/* oxlint-disable-next-line next/no-img-element */}
              <img
                src={`${import.meta.env.BASE_URL}archive/railway-student-entry-20261006.webp`}
                alt="一位男生和一位女生在安全站台上学习，身后是列车、轨道和接触网的铁路主题插画"
                width={1200}
                height={800}
                fetchPriority="high"
              />
              <figcaption>
                <TrainFront size={15} />
                你的铁路英语旅程
              </figcaption>
            </figure>
            <nav className="archive-rail-route" aria-label="学习旅程快捷入口">
              <a href={sitePath('profile')}>
                <span>
                  <UserRound size={20} />
                </span>
                <strong>学情起点</strong>
              </a>
              <a href={sitePath('words')}>
                <span>
                  <Headphones size={20} />
                </span>
                <strong>单词跟读</strong>
              </a>
              <a href={sitePath()}>
                <span>
                  <TrainFront size={20} />
                </span>
                <strong>课程任务</strong>
              </a>
            </nav>
          </section>
          <section className="archive-access archive-rail-ticket">
            {pending ? (
              <>
                <span className="archive-step">申请已发送</span>
                <h2>正在连接课堂任务</h2>
                <p>
                  姓名：{pending.name}
                  <br />
                  班级：{pending.className}
                </p>
                <p>
                  不用等待老师，连接后即可开始。老师课后确认身份，再关联个人档案。
                </p>
                <div className="archive-existing">
                  <strong>等待时也能先练习</strong>
                  <div>
                    <a href={sitePath('words')}>开始单词跟读 →</a>
                    <a href={sitePath('student')}>开始口语练习 →</a>
                  </div>
                </div>
                <small>
                  本次申请有效期至{' '}
                  {new Date(pending.expiresAt).toLocaleString('zh-CN')}。
                </small>
                <button
                  className="archive-secondary"
                  onClick={() => {
                    setPendingAccess(null);
                    setPending(null);
                    setError('');
                  }}
                >
                  修改姓名 / 班级
                </button>
              </>
            ) : (
              <form onSubmit={requestAccess}>
                <div className="archive-ticket-heading">
                  <span className="archive-ticket-icon">
                    <TrainFront size={23} />
                  </span>
                  <div>
                    <span className="archive-step">MY LEARNING PASS</span>
                    <h2>进入我的档案</h2>
                  </div>
                  <span className="archive-ticket-stamp">无需密码</span>
                </div>
                <label>
                  姓名
                  <input
                    required
                    maxLength={30}
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="真实姓名（不带班级）"
                  />
                </label>
                <StudentClassField
                  value={className}
                  onChange={setClassName}
                  theme="profile"
                  compactHelp
                />
                <label className="archive-checkbox">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  私人设备记住我30天（公共设备勿选）
                </label>
                <label className="archive-checkbox">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  我同意本人及授权教师查看我的学习记录
                </label>
                <button
                  className="archive-primary"
                  disabled={
                    busy || !name.trim() || !className.trim() || !consent
                  }
                >
                  {busy ? '正在发送…' : '进入课堂 / 我的档案'}
                  <ArrowRight size={18} />
                </button>
                <details className="archive-entry-help">
                  <summary>
                    <ShieldCheck size={15} />
                    首次登录 / 换设备说明
                  </summary>
                  <p>
                    填姓名、选班级即可先做任务；教师课后确认后可查看历史档案，不用密码。手机丢失可请老师撤销旧设备。
                  </p>
                  <p>
                    勾选“记住我”仅适用于私人设备，有效期30天。公共电脑请勿勾选。记录仅供本人及授权教师查看。
                  </p>
                </details>
              </form>
            )}
            <div className="archive-existing">
              <strong>直接开始练习 · 无需等待确认</strong>
              <div>
                <a href={sitePath('words')}>
                  <Headphones size={16} />
                  单词
                </a>
                <a href={sitePath('student')}>
                  <MessageCircle size={16} />
                  口语
                </a>
                <a href={sitePath()}>
                  <TrainFront size={16} />
                  课程
                </a>
              </div>
            </div>
          </section>
        </div>
      )}
      {!token && pending?.practiceToken && (
        <section className="archive-content">
          <div className="archive-hello">
            <div>
              <span className="archive-eyebrow">课堂练习 · 先做任务</span>
              <h1>{pending.name}</h1>
              <p>{pending.className} · 身份待教师课后确认</p>
            </div>
            <button
              className="archive-secondary"
              onClick={() => {
                setPendingAccess(null);
                setPending(null);
                clearArchiveToken();
                setError('');
              }}
            >
              换一位学生
            </button>
          </div>
          <p className="archive-small">
            提交后，成绩由服务器保存。此处只显示本次课堂身份的成绩；历史档案需老师确认，不会覆盖原记录。
          </p>
          {pending.requestId && (
            <details className="archive-small">
              <summary>课后给老师核对本机申请</summary>
              <p>
                本机申请标记：{pending.requestId.slice(-8)}
                。请本人向老师展示此页；老师只需核对标记后点击确认，无需输入验证码。
              </p>
            </details>
          )}
          <CourseBoard onOpen={openTask} />
        </section>
      )}
      {token && !data && (
        <section className="archive-loading">
          <RefreshCw className={busy ? 'archive-spin' : ''} />
          <h2>{busy ? '正在整理你的学习足迹…' : '暂时没有加载到档案'}</h2>
          <p>原有录音、分数和调查记录不会被更改。</p>
          {!busy && <button onClick={() => void load()}>重新读取</button>}
        </section>
      )}
      {data && (
        <div className="archive-content">
          <section className="archive-hello">
            <div>
              <span className="archive-eyebrow">MY LEARNING PASSPORT</span>
              <h1>{data.student.name}的学习档案</h1>
              <p>{data.student.className}</p>
            </div>
            <button
              className="archive-secondary"
              disabled={busy}
              onClick={() => void load()}
            >
              <RefreshCw size={16} className={busy ? 'archive-spin' : ''} />
              刷新记录
            </button>
          </section>
          {data.warnings?.length || data.hasMore ? (
            <div className="archive-warning">
              {data.warnings?.join('；') ||
                '历史记录较多，部分记录暂未载入。请联系老师核对，不能将未显示视为丢失。'}
            </div>
          ) : null}
          <nav className="archive-tabs" aria-label="档案馆栏目">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(id)}
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </nav>
          {tab === 'portrait' && (
            <>
              <details>
                <summary>Unit 1 · 第2课作答明细</summary>
                <Unit2Panel data={data.unit2} />
              </details>
              <section className="archive-portrait-grid">
                <article className="archive-card archive-avatar-card">
                  <span className="archive-eyebrow">MY LEARNING COMPANION</span>
                  <LearningAvatar variant={avatar} name={data.student.name} />
                  <div className="avatar-choices">
                    <button
                      aria-pressed={avatar === 'explorer'}
                      onClick={() => {
                        setAvatar('explorer');
                        localStorage.setItem('july.archive.avatar', 'explorer');
                      }}
                    >
                      探索者
                    </button>
                    <button
                      aria-pressed={avatar === 'engineer'}
                      onClick={() => {
                        setAvatar('engineer');
                        localStorage.setItem('july.archive.avatar', 'engineer');
                      }}
                    >
                      协作者
                    </button>
                  </div>
                  <p className="archive-small">
                    形象由你选择；强项和待练方向由记录说明。
                  </p>
                </article>
                <article className="archive-card archive-radar-card">
                  <div className="archive-section-heading">
                    <div>
                      <span className="archive-eyebrow">SKILL PORTRAIT</span>
                      <h2>我的七维英语画像</h2>
                    </div>
                    <button
                      className="archive-secondary"
                      onClick={() => setReflection(true)}
                    >
                      更新阶段自评
                    </button>
                  </div>
                  <SkillRadar skills={skills} previous={previous} />
                  <p className="archive-small">
                    {snapshots.length
                      ? `当前自评：${date(snapshots[0].createdAt)}`
                      : data.profile
                        ? '当前来自你的学情调查'
                        : '还没有起点数据，可先做一次自评或学情调查。'}
                    。历史自评会保留，不覆盖前一次。
                  </p>
                </article>
              </section>
              <section className="archive-evidence">
                <div>
                  <span>单词练习证据</span>
                  <strong>
                    {wordRecords.length}
                    <small>次</small>
                  </strong>
                  <p>跟读记录与录音</p>
                </div>
                <div>
                  <span>情景口语证据</span>
                  <strong>
                    {speakingRecords.length}
                    <small>次</small>
                  </strong>
                  <p>任务表现，不等于发音等级</p>
                </div>
                <div>
                  <span>成长时间点</span>
                  <strong>
                    {snapshots.length + (data.profile ? 1 : 0)}
                    <small>个</small>
                  </strong>
                  <p>起点调查与阶段自评</p>
                </div>
                <div>
                  <span>已交课堂小测</span>
                  <strong>
                    {records.filter((row) => row.type === 'quiz').length}
                    <small>次</small>
                  </strong>
                  <p>对照题目看反馈</p>
                </div>
              </section>
              <section className="archive-section-heading">
                <div>
                  <span className="archive-eyebrow">ONE SMALL STEP</span>
                  <h2>下一站，先练这两件事</h2>
                </div>
                <small>依据你的当前自评，不是能力诊断</small>
              </section>
              <div className="archive-advice-grid">
                {weak.length ? (
                  weak.map((key) => (
                    <article className="archive-card" key={key}>
                      <span className="archive-tag">
                        {SKILL_LABELS[key]} · 当前自评 {skills![key]}/5
                      </span>
                      <h3>{advice[key].title}</h3>
                      <p>{advice[key].steps}</p>
                      <small>推荐：{advice[key].route}</small>
                    </article>
                  ))
                ) : (
                  <article className="archive-card">
                    <h3>先认识自己的起点</h3>
                    <p>
                      填写自评后，这里会根据你认为较需要练习的两项，给出具体的小任务。
                    </p>
                    <button
                      className="archive-primary"
                      onClick={() => setReflection(true)}
                    >
                      完成首次自评
                    </button>
                  </article>
                )}
              </div>
              <section className="archive-card archive-goal">
                <Compass />
                <div>
                  <h3>我想去的方向</h3>
                  <p>
                    {snapshots[0]?.goals ||
                      data.profile?.semester_goal ||
                      data.profile?.learning_goals?.join(' · ') ||
                      '给自己定一个小目标：例如在车站场景里，用英语完成一次问路对话。'}
                  </p>
                </div>
              </section>
            </>
          )}
          {tab === 'path' && (
            <>
              <CourseBoard
                tasks={tasks}
                progress={data.courseProgress}
                onOpen={openTask}
              />
              <details className="archive-card">
                <summary>Unit 1 · 第2课作答与雷达明细</summary>
                <Unit2Panel data={data.unit2} links={false} />
              </details>
              <details className="archive-card">
                <summary>阶段自评记录 · {snapshots.length}次</summary>
                {snapshots.map((snapshot) => (
                  <p key={snapshot.id}>
                    {date(snapshot.createdAt)} ·{' '}
                    {snapshot.goals || '已完成能力自评'}
                  </p>
                ))}
                {!snapshots.length && <p>暂无阶段自评。</p>}
              </details>
            </>
          )}
          {tab === 'works' && <Portfolio records={records} />}
          {tab === 'news' && <NewsCards news={news} />}
          <p className="archive-privacy">
            <ShieldCheck size={16} />
            只显示与你已确认身份匹配的记录。班级写法不明确或同班同名时，请老师核对；不会自动将别人的记录合入。
          </p>
        </div>
      )}
      {!token && news.length > 0 && (
        <section className="archive-public-news">
          <NewsCards news={news} />
        </section>
      )}
      <footer className="archive-footer">
        Liuzhou Railway Vocational Technical College · 学英语，也连接铁路世界
      </footer>
      {quiz && (token || pending?.practiceToken) && (
        <QuizDialog
          task={quiz}
          token={token || pending!.practiceToken!}
          onClose={() => setQuiz(null)}
          onSaved={() => {
            if (token) void load();
          }}
        />
      )}
      {reflection && token && (
        <ReflectionDialog
          token={token}
          skills={skills}
          onClose={() => setReflection(false)}
          onSaved={() => {
            setReflection(false);
            setNotice('本次自评已保存为新的时间点，之前记录仍保留。');
            void load();
          }}
        />
      )}
    </main>
  );
}

function LegacyLinks() {
  return (
    <div className="archive-legacy-links">
      <a href={sitePath('profile')}>
        <UserRound />
        学情调查<small>学期起点</small>
      </a>
      <a href={sitePath('words')}>
        <Headphones />
        单词跟读<small>每课任务</small>
      </a>
      <a href={sitePath('student')}>
        <MessageCircle />
        校园情景口语<small>Unit 1</small>
      </a>
    </div>
  );
}

function Portfolio({ records }: { records: ArchiveHistory[] }) {
  const [filter, setFilter] = useState('all');
  const shown = records.filter(
    (row) => filter === 'all' || row.type === filter,
  );
  return (
    <section>
      <div className="archive-section-heading">
        <div>
          <span className="archive-eyebrow">MY LEARNING COLLECTION</span>
          <h2>作品与反馈</h2>
          <p>回到当时的回答，听见自己的变化。</p>
        </div>
        <label>
          记录类型
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">全部</option>
            <option value="word">单词跟读</option>
            <option value="speaking">情景口语</option>
            <option value="quiz">课堂小测</option>
            <option value="unit2">第二课测试与写作</option>
            <option value="profile">学情调查</option>
          </select>
        </label>
      </div>
      {shown.length ? (
        shown.map((row) => (
          <article
            className="archive-card archive-work"
            key={`${row.type}-${row.id}`}
          >
            <header>
              <div>
                <span className="archive-tag">
                  {{
                    word: '单词跟读',
                    speaking: '情景口语',
                    quiz: '课堂小测',
                    unit2: '第二课',
                    profile: '学情调查',
                  }[row.type] || '学习记录'}
                </span>
                <h3>{row.title}</h3>
                <small>{date(row.submittedAt)}</small>
              </div>
              <strong>{numberScore(row.score)}</strong>
            </header>
            {typeof row.details === 'string' && (
              <p className="archive-transcript">{row.details}</p>
            )}
            {!!row.details && typeof row.details === 'object' && (
              <details>
                <summary>查看本次反馈</summary>
                <RecordFeedback row={row} />
              </details>
            )}
            {row.audio?.map((clip, i) => (
              <label className="archive-audio" key={i}>
                {clip.label || `录音 ${i + 1}`}
                {/* Original student recordings have no timed captions; recognition text is available in the feedback above. */}
                {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
                <audio controls preload="none" src={safeHref(clip.url)} />
              </label>
            ))}
            {row.type !== 'profile' &&
              row.type !== 'unit2' &&
              !row.audio?.length &&
              row.type !== 'quiz' && (
                <p className="archive-small">
                  本条暂未取得可回听音频。可刷新链接，或请老师到原练习页核对。
                </p>
              )}
          </article>
        ))
      ) : (
        <div className="archive-empty">
          <Headphones />
          <h3>还没有这类学习记录</h3>
          <p>
            完成任务并成功上传后，会在这里出现；身份不匹配的旧记录请老师协助核对。
          </p>
          <LegacyLinks />
        </div>
      )}
    </section>
  );
}

type QuizFeedback = {
  prompt?: string;
  options?: string[];
  selected?: number;
  answer?: number;
  correct?: boolean;
  explanation?: string;
  message?: string;
};
type RecordFeedbackDetails = {
  teacherName?: string;
  averageSelf?: number | null;
  results?: {
    word?: string;
    score?: number | null;
    transcript?: string;
    selfRating?: number | null;
  }[];
  transcript?: string;
  feedback?: string | QuizFeedback[] | Record<string, unknown>;
  learning_goals?: string[];
  semester_goal?: string;
};
type QuizResult = { score?: number; feedback?: string | QuizFeedback[] };

function RecordFeedback({ row }: { row: ArchiveHistory }) {
  if (
    !row.details ||
    typeof row.details !== 'object' ||
    Array.isArray(row.details)
  )
    return null;
  const detail = row.details as RecordFeedbackDetails;
  if (row.type === 'unit2') {
    const content = row.details as {
      essay?: string;
      feedback?: {
        prompt: string;
        selected: string;
        answer: string;
        correct: boolean;
        explanation?: string;
      }[];
    };
    return (
      <div className="archive-details">
        {content.essay && <p className="archive-transcript">{content.essay}</p>}
        {content.feedback?.map((item, i) => (
          <article key={i}>
            <strong>
              {item.prompt} · {item.correct ? '✓' : '待巩固'}
            </strong>
            {item.selected && <p>你的答案：{item.selected}</p>}
            {item.answer && <p>参考答案：{item.answer}</p>}
            {item.explanation && <p>{item.explanation}</p>}
          </article>
        ))}
      </div>
    );
  }
  if (row.type === 'word')
    return (
      <div className="archive-details">
        <p>
          任课教师：{detail.teacherName || '课程教师'} · 跟读自评：
          {detail.averageSelf ?? '未填写'}
        </p>
        {Array.isArray(detail.results) &&
          detail.results.map((item, i) => (
            <article key={i}>
              <strong>
                {item.word || `第${i + 1}词`} · {numberScore(item.score)}
              </strong>
              <p>识别文字：{item.transcript || '未返回文字，请结合录音判断'}</p>
              <p>自评：{item.selfRating ?? '未填写'}</p>
            </article>
          ))}
      </div>
    );
  if (row.type === 'speaking')
    return (
      <div className="archive-details">
        <p>对话文字</p>
        <p className="archive-transcript">
          {detail.transcript || '未返回识别文字，请回听真实录音。'}
        </p>
        <p>
          系统建议：
          {typeof detail.feedback === 'string'
            ? detail.feedback
            : '请结合录音和教师反馈判断。'}
        </p>
        <p className="archive-small">
          分数用于本次任务反馈，不作为专业发音或完整英语水平评定。
        </p>
      </div>
    );
  if (row.type === 'quiz')
    return (
      <div className="archive-details">
        {Array.isArray(detail.feedback) &&
          detail.feedback.map((item: QuizFeedback, i) => (
            <article key={i}>
              <strong>
                {i + 1}. {item.prompt} {item.correct ? '✓' : '待巩固'}
              </strong>
              <p>
                你的选择：{item.options?.[item.selected ?? -1] || '未答'} ·
                参考答案：
                {item.options?.[item.answer ?? -1] || ''}
              </p>
              <p>{item.explanation || ''}</p>
            </article>
          ))}
      </div>
    );
  return (
    <div className="archive-details">
      <p>
        学习目标：
        {Array.isArray(detail.learning_goals)
          ? detail.learning_goals.join('、')
          : '未填写'}
      </p>
      <p>学期计划：{String(detail.semester_goal || '未填写')}</p>
      <p className="archive-small">
        能力自评在“我的画像”查看。原调查在教师端完整保存。
      </p>
    </div>
  );
}

function NewsCards({ news }: { news: ArchiveNews[] }) {
  return (
    <section>
      <div className="archive-section-heading">
        <div>
          <span className="archive-eyebrow">RAILWAY ENGLISH WINDOW</span>
          <h2>让英语连接真实铁路世界</h2>
          <p>中国铁路 · 马东铁 · 国际铁路。教师审核选题，原文日期始终可见。</p>
        </div>
      </div>
      {news.length ? (
        <div className="archive-news-grid">
          {news.map((item) => (
            <article className="archive-card" key={item.id}>
              <span className="archive-tag">{item.source}</span>
              <small className="archive-news-date">
                原文 {item.publishedDate || '日期未提供'}
              </small>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <div className="archive-word-chips">
                {item.vocabulary?.map((v) => (
                  <span key={v.word}>
                    <b>{v.word}</b> {v.meaning}
                  </span>
                ))}
              </div>
              {item.question && (
                <blockquote>
                  <small>THINK IN ENGLISH</small>
                  {item.question}
                </blockquote>
              )}
              <a
                href={safeHref(item.url)}
                target="_blank"
                rel="noopener noreferrer"
              >
                阅读原文 <ArrowRight size={16} />
              </a>
            </article>
          ))}
        </div>
      ) : (
        <div className="archive-empty">
          <TrainFront />
          <h3>铁路英语选题正在等老师发布</h3>
          <p>每篇内容都会保留来源和发布日期，不把旧报道当作最新消息。</p>
        </div>
      )}
    </section>
  );
}

function useArchiveDialog(onClose: () => void, busy: boolean) {
  const element = useRef<HTMLElement>(null);
  const current = useRef({ onClose, busy });
  useEffect(() => {
    current.current = { onClose, busy };
  }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = element.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !current.current.busy) {
        event.preventDefault();
        current.current.onClose();
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
        ),
      ).filter((item) => item.getClientRects().length > 0);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', handleKey);
    return () => {
      dialog.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return element;
}

function ReflectionDialog({
  token,
  skills,
  onClose,
  onSaved,
}: {
  token: string;
  skills?: Record<string, number> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(skillKeys.map((key) => [key, skills?.[key] || 3])),
  );
  const [goals, setGoals] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useArchiveDialog(onClose, busy);
  return (
    <div className="archive-modal-backdrop">
      {/* This custom dialog already manages focus, Escape, focus trapping and scroll locking. */}
      {/* oxlint-disable jsx-a11y/prefer-tag-over-role */}
      <section
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reflection-title"
        className="archive-modal"
      >
        {/* oxlint-enable jsx-a11y/prefer-tag-over-role */}
        <div className="archive-section-heading">
          <h2 id="reflection-title">给今天的自己留一个坐标</h2>
          <button disabled={busy} onClick={onClose}>
            关闭
          </button>
        </div>
        <p>
          1＝需要很多帮助，3＝能完成基础任务，5＝在熟悉场景中较有把握。请逐项调整；这不是考试。
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            try {
              await archiveRequest('saveReflection', {
                studentToken: token,
                skills: values,
                goals,
              });
              onSaved();
            } catch (err) {
              setError(err instanceof Error ? err.message : '保存失败');
            } finally {
              setBusy(false);
            }
          }}
        >
          {skillKeys.map((key) => (
            <label key={key} className="archive-range">
              <span>{SKILL_LABELS[key]}</span>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={values[key]}
                onChange={(event) =>
                  setValues({ ...values, [key]: Number(event.target.value) })
                }
              />
              <strong>{values[key]}/5</strong>
            </label>
          ))}
          <label>
            我的下一步小目标
            <textarea
              required
              maxLength={500}
              value={goals}
              onChange={(event) => setGoals(event.target.value)}
              placeholder="例如：下一次用英语说明一次机车检查流程。"
            />
          </label>
          {error && (
            <p role="alert" className="archive-alert">
              {error}
            </p>
          )}
          <button className="archive-primary" disabled={busy}>
            {busy ? '正在保存…' : '保存本次自评（保留历史）'}
          </button>
        </form>
      </section>
    </div>
  );
}

function QuizDialog({
  task,
  token,
  onClose,
  onSaved,
}: {
  task: ArchiveTask;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [answers, setAnswers] = useState<number[]>(
    Array(task.questions?.length || 0).fill(-1),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<QuizResult | null>(null);
  const [requestId] = useState(() =>
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const dialogRef = useArchiveDialog(onClose, busy);
  return (
    <div className="archive-modal-backdrop">
      {/* This custom dialog already manages focus, Escape, focus trapping and scroll locking. */}
      {/* oxlint-disable jsx-a11y/prefer-tag-over-role */}
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="archive-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-title"
      >
        {/* oxlint-enable jsx-a11y/prefer-tag-over-role */}
        <div className="archive-section-heading">
          <div>
            <small>
              {task.unit} · {task.lesson}
            </small>
            <h2 id="quiz-title">{task.title}</h2>
          </div>
          <button disabled={busy} onClick={onClose}>
            关闭
          </button>
        </div>
        {task.material && (
          <div className="archive-reading">{task.material}</div>
        )}
        {result ? (
          <div className="archive-quiz-result">
            <CheckCircle2 />
            <h3>已保存到你的档案</h3>
            <strong>{numberScore(result.score)}</strong>
            <p>小测反映本次题目完成情况，不代表完整英语水平。</p>
            {Array.isArray(result.feedback) ? (
              result.feedback.map((item, i) => (
                <article key={i}>
                  <b>
                    第{i + 1}题 {item.correct ? '✓' : '请再看一遍'}
                  </b>
                  <p>{item.explanation || item.message || ''}</p>
                </article>
              ))
            ) : typeof result.feedback === 'string' ? (
              <p>{result.feedback}</p>
            ) : null}
            <button className="archive-primary" onClick={onClose}>
              返回学习路径
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!answers.length || answers.includes(-1)) return;
              setBusy(true);
              setError('');
              try {
                const response = await archiveRequest<QuizResult>(
                  'submitQuiz',
                  {
                    studentToken: token,
                    taskId: task.id,
                    taskVersion: task.version,
                    answers,
                    requestId,
                  },
                );
                setResult(response);
                onSaved();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : '提交失败，可重试，不会重复记分。',
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {task.questions?.map((question, i) => (
              <fieldset className="archive-question" key={question.id || i}>
                <legend>
                  {i + 1}. {question.prompt}
                </legend>
                {question.options.map((option, j) => (
                  <label key={j}>
                    <input
                      type="radio"
                      name={`q${i}`}
                      checked={answers[i] === j}
                      onChange={() =>
                        setAnswers((current) =>
                          current.map((value, k) => (k === i ? j : value)),
                        )
                      }
                    />
                    {String.fromCharCode(65 + j)}. {option}
                  </label>
                ))}
              </fieldset>
            ))}
            {error && (
              <p role="alert" className="archive-alert">
                {error}
              </p>
            )}
            <button
              className="archive-primary"
              disabled={busy || !answers.length || answers.includes(-1)}
            >
              {busy ? '正在保存…' : '交卷并查看反馈'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
