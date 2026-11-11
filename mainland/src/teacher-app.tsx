/* oxlint-disable next/no-html-link-for-pages, jsx-a11y/media-has-caption */
import {
  BarChart3,
  Download,
  Headphones,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createSchoolClassDirectory as createClassDirectory } from '@/lib/school-classes';
import { SchoolClassFilter } from '@/components/school-class-filter';
import { CLASS_CATALOG } from '@/lib/class-catalog';
import { ClassGroupingNote } from '@/components/class-grouping-note';
import {
  clearTeacherToken,
  cloudbaseRequest,
  getTeacherToken,
  sitePath,
} from './api';

type AudioMeta = {
  key: string;
  type: string;
  size: number;
  round: number;
  url?: string;
};

type AttemptRow = {
  raw_student_name?: string;
  raw_class_name?: string;
  class_identity_name?: string;
  id: string;
  student_name: string;
  student_id: string;
  class_name: string;
  scene_title: string;
  transcript: string;
  task_score: number | null;
  sentence_score: number | null;
  clarity_score: number | null;
  interaction_score: number | null;
  total_score: number | null;
  feedback: string | null;
  audio_manifest: string | null;
  duration_seconds: number;
  attempts: number;
  submitted_at: number;
};

const PAGE_SIZE = 30;

function RecordPager({
  page, total, loading, label, onPage,
}: {
  page: number;
  total: number;
  loading: boolean;
  label: string;
  onPage: (page: number) => void;
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#687168]">
      <span>第 {page + 1} / {Math.max(1, Math.ceil(total / PAGE_SIZE))} 页 · 每页 {PAGE_SIZE} 条</span>
      <div className="flex gap-2">
        <button type="button" disabled={loading || page === 0} onClick={() => onPage(page - 1)} className="focus-ring rounded-xl border px-3 py-2 disabled:opacity-40">上一页</button>
        <button type="button" disabled={loading || (page + 1) * PAGE_SIZE >= total} onClick={() => onPage(page + 1)} className="focus-ring rounded-xl border px-3 py-2 disabled:opacity-40">下一页 · 更早记录</button>
      </div>
    </nav>
  );
}

function parseAudio(value: string | null): AudioMeta[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as AudioMeta[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => Boolean(item?.key))
      : [];
  } catch {
    return [];
  }
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="rounded-3xl border border-[#e6d2c1] bg-white p-5 shadow-soft">
      {icon}
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm text-[#687168]">{label}</p>
    </div>
  );
}

export function TeacherApp() {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classKeyword, setClassKeyword] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [collegeFilter, setCollegeFilter] = useState('');
  const [teacherName, setTeacherName] = useState('');

  useEffect(() => {
    let active = true;
    const token = getTeacherToken();
    if (!token) {
      window.location.replace(sitePath('teacher/login'));
      return;
    }
    setLoading(true);
    setError('');
    void cloudbaseRequest<{ rows: AttemptRow[]; total: number; teacherName?: string }>(
      'list',
      { offset: page * PAGE_SIZE, limit: PAGE_SIZE },
      token,
    )
      .then((payload) => {
        if (!active || !payload) return;
        setRows(payload.rows || []);
        setTotal(payload.total || 0);
        setTeacherName(payload.teacherName || '');
      })
      .catch((requestError) => {
        if (!active) return;
        const message = requestError instanceof Error ? requestError.message : '学生数据加载失败。';
        if (message.includes('登录已失效')) {
          clearTeacherToken();
          window.location.replace(sitePath('teacher/login'));
        } else {
          setError(message);
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page]);

  const classDirectory = useMemo(() => createClassDirectory(rows, CLASS_CATALOG.map(class_name => ({ class_name }))), [rows]);
  const classGroups = classDirectory.groups;
  const filteredRows = useMemo(
    () => rows.filter(row => (!collegeFilter || classDirectory.resolve(row).college === collegeFilter) && (!classFilter || classDirectory.resolve(row).key === classFilter) && classDirectory.matches(row, classKeyword)),
    [classFilter, collegeFilter, classKeyword, classDirectory, rows],
  );

  const scoredRows = filteredRows.filter((row) => row.total_score !== null);
  const studentCount = new Set(filteredRows.map((row) => `${classDirectory.resolve(row).key}|${row.student_id || row.student_name}`)).size;
  const recordingCount = filteredRows.filter(
    (row) => parseAudio(row.audio_manifest).length > 0,
  ).length;
  const averageScore = scoredRows.length
    ? Math.round(
        scoredRows.reduce((sum, row) => sum + Number(row.total_score), 0) /
          scoredRows.length,
      )
    : 0;

  async function logout() {
    const token = getTeacherToken();
    if (token)
      await cloudbaseRequest('logout', {}, token).catch(() => undefined);
    clearTeacherToken();
    window.location.replace(sitePath('teacher/login'));
  }

  function exportCsv() {
    const cell = (value: unknown) => {
      const text =
        value == null
          ? ''
          : typeof value === 'string' ||
              typeof value === 'number' ||
              typeof value === 'boolean'
            ? String(value)
            : JSON.stringify(value);
      return `"${text.replace(/"/g, '""')}"`;
    };
    const headers = [
      '提交时间',
      '姓名',
      '学号',
      '学生原填班级',
      '统计班级',
      '场景',
      '任务信息/40',
      '句型使用/30',
      '识别清晰度/20',
      '话轮完成/10',
      '总分/100',
      '用时秒',
      '录制次数',
      '对话文本',
      '系统建议',
      '录音状态',
    ];
    const lines = filteredRows.map((row) =>
      [
        new Date(row.submitted_at).toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
        }),
        row.student_name,
        row.student_id,
        row.raw_class_name ?? row.class_name,
        classDirectory.resolve(row).label,
        row.scene_title,
        row.task_score,
        row.sentence_score,
        row.clarity_score,
        row.interaction_score,
        row.total_score,
        row.duration_seconds,
        row.attempts,
        row.transcript,
        row.feedback,
        parseAudio(row.audio_manifest).length ? '有录音' : '无录音',
      ]
        .map(cell)
        .join(','),
    );
    const blob = new Blob(
      [`\uFEFF${[headers.map(cell).join(','), ...lines].join('\r\n')}`],
      { type: 'text/csv;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `speaking-attempts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen pb-12">
      <header className="glass sticky top-0 z-20 border-b border-[#ecd3bf]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#416b36]">
              {teacherName
                ? `${teacherName} · 负责班级数据`
                : 'July English Lab'}
            </p>
            <h1 className="serif text-2xl font-bold text-[#d94f08]">
              教师口语数据
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || Boolean(error)}
              aria-label="导出当前页筛选结果"
              className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[#416b36] px-4 py-2.5 text-sm font-bold text-white"
            >
              <Download className="h-4 w-4" />{' '}
              <span className="hidden sm:inline">导出本页CSV</span>
            </button>
            <button
              onClick={() => void logout()}
              className="focus-ring grid h-10 w-10 place-items-center rounded-xl border border-[#dec8b4] bg-white text-[#687168]"
              aria-label="退出教师端"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pt-7">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={<Users className="h-5 w-5 text-[#ea5a0b]" />}
            value={total}
            label="历史练习记录"
          />
          <Metric
            icon={<MessageSquareText className="h-5 w-5 text-[#ea5a0b]" />}
            value={studentCount}
            label="本页匹配学生"
          />
          <Metric
            icon={<BarChart3 className="h-5 w-5 text-[#ea5a0b]" />}
            value={scoredRows.length ? `${averageScore}分` : '—'}
            label="本页平均得分"
          />
          <Metric
            icon={<Headphones className="h-5 w-5 text-[#ea5a0b]" />}
            value={recordingCount}
            label="本页可回听记录"
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-[#e2cebd] bg-white shadow-soft">
          <div className="border-b border-[#eee0d4] px-5 py-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-bold">口语练习记录</h2>
                <p className="mt-1 text-sm text-[#7a7168]">
                  共 {total} 条历史记录，按提交时间由近到远排列。点击「下一页」查看更早记录。
                </p>
              </div>
              <p
                aria-live="polite"
                className="rounded-full bg-[#edf6f8] px-3 py-1.5 text-sm font-bold text-[#315f6b]"
              >
                {total ? `第 ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} 条` : '暂无记录'}
              </p>
            </div>
            <p className="mt-2 text-xs text-[#7a7168]">班级筛选、均分及导出以当前页为准；本页匹配 {filteredRows.length} 条。</p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <SchoolClassFilter college={collegeFilter} classKey={classFilter} groups={classGroups} onCollege={setCollegeFilter} onClass={setClassFilter} className="focus-ring h-12 w-full rounded-2xl border border-[#d9c4b2] bg-[#fffaf6] px-3 text-base" />
              <label className="relative block">
                <span className="sr-only">按班级关键词筛选</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7b746c]" />
                <input
                  type="search"
                  value={classKeyword}
                  onChange={(event) => { setClassKeyword(event.target.value); setClassFilter(''); }}
                  placeholder="搜索班级，如：城轨信号54班、54班"
                  className="focus-ring h-12 w-full rounded-2xl border border-[#d9c4b2] bg-[#fffaf6] pl-11 pr-11 text-base text-[#332b25] placeholder:text-[#9a9189]"
                />
                {classKeyword && (
                  <button
                    type="button"
                    onClick={() => { setClassKeyword(''); setClassFilter(''); }}
                    aria-label="清除班级筛选"
                    className="focus-ring absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#7b746c] hover:bg-[#f1e7de]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
              <div
                className="flex max-h-28 flex-wrap gap-2 overflow-y-auto"
                aria-label="班级快捷筛选"
              >
                <button
                  type="button"
                  onClick={() => { setClassKeyword(''); setClassFilter(''); }}
                  className={`focus-ring rounded-full border px-3 py-2 text-sm font-bold ${!classKeyword && !classFilter ? 'border-[#416b36] bg-[#416b36] text-white' : 'border-[#d8c5b5] bg-white text-[#655c54]'}`}
                >
                  本页全部 · {rows.length}
                </button>
                {classGroups.filter(group => !collegeFilter || group.college === collegeFilter).map((group) => {
                  const active = classFilter === group.key;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => { setClassFilter(group.key); setClassKeyword(''); }}
                      className={`focus-ring rounded-full border px-3 py-2 text-sm font-bold ${active ? 'border-[#ea5a0b] bg-[#fff0e4] text-[#c94a07]' : 'border-[#d8c5b5] bg-white text-[#655c54]'}`}
                    >
                      {group.label} · {group.count}
                    </button>
                  );
                })}
              </div>
            </div>
            <ClassGroupingNote groups={classGroups} />
            <div className="mt-4"><RecordPager page={page} total={total} loading={loading} label="列表上方翻页" onPage={setPage} /></div>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-3 px-5 py-20 text-[#687168]">
              <LoaderCircle className="h-5 w-5 animate-spin" />{' '}
              正在加载学生数据…
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="px-5 py-16 text-center font-bold text-[#b33d08]"
            >
              {error}
            </div>
          )}
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1380px] border-collapse text-left text-sm">
                <thead className="bg-[#fff4ea] text-[#67584c]">
                  <tr>
                    {[
                      '提交时间',
                      '学生',
                      '班级',
                      '场景',
                      '总分',
                      '分项得分',
                      '录音',
                      '对话文本',
                      '系统建议',
                    ].map((heading) => (
                      <th key={heading} className="px-4 py-3 font-bold">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const clips = parseAudio(row.audio_manifest);
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-[#f0e4da] align-top hover:bg-[#fffbf7]"
                      >
                        <td className="whitespace-nowrap px-4 py-4 text-[#687168]">
                          {new Date(row.submitted_at).toLocaleString('zh-CN', {
                            timeZone: 'Asia/Shanghai',
                          })}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold">{row.student_name}</p>
                          <p className="text-xs text-[#7a7168]">
                            {row.student_id}
                          </p>
                        </td>
                        <td className="px-4 py-4"><strong>{classDirectory.resolve(row).label}</strong>{classDirectory.resolve(row).label !== (row.raw_class_name ?? row.class_name) && <p className="mt-1 text-xs text-[#7a7168]">原填：{row.raw_class_name ?? row.class_name}</p>}</td>
                        <td className="px-4 py-4 font-bold text-[#416b36]">
                          {row.scene_title}
                        </td>
                        <td className="px-4 py-4 text-xl font-black text-[#d94f08]">
                          {row.total_score ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 leading-6">
                          任务 {row.task_score ?? '—'}/40
                          <br />
                          句型 {row.sentence_score ?? '—'}/30
                          <br />
                          清晰 {row.clarity_score ?? '—'}/20
                          <br />
                          话轮 {row.interaction_score ?? '—'}/10
                        </td>
                        <td className="min-w-72 px-4 py-4">
                          <div className="space-y-2">
                            {clips.length ? (
                              clips.map((clip) => (
                                <div
                                  key={clip.key}
                                  className="flex items-center gap-2"
                                >
                                  <span className="w-12 text-xs font-bold">
                                    第{clip.round}轮
                                  </span>
                                  {clip.url ? (
                                    <audio
                                      controls
                                      preload="none"
                                      src={clip.url}
                                      className="h-9 w-52"
                                    />
                                  ) : (
                                    <span className="text-xs text-[#8a837c]">
                                      链接已过期，请刷新
                                    </span>
                                  )}
                                </div>
                              ))
                            ) : (
                              <span className="text-[#8a837c]">无录音</span>
                            )}
                          </div>
                        </td>
                        <td className="max-w-md whitespace-pre-line px-4 py-4 leading-6 text-[#59645a]">
                          {row.transcript}
                        </td>
                        <td className="max-w-sm px-4 py-4 leading-6 text-[#59645a]">
                          {row.feedback || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && (
                <div className="px-5 py-16 text-center text-[#7a7168]">
                  还没有学生提交练习。
                </div>
              )}
              {rows.length > 0 && filteredRows.length === 0 && (
                <div className="px-5 py-16 text-center">
                  <p className="font-bold text-[#59645a]">
                    本页没有符合筛选的记录，可以翻页查看更早提交。
                  </p>
                  <button
                    type="button"
                    onClick={() => { setClassKeyword(''); setClassFilter(''); setCollegeFilter(''); }}
                    className="focus-ring mt-3 rounded-xl bg-[#416b36] px-4 py-2.5 text-sm font-bold text-white"
                  >
                    查看本页全部记录
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="border-t border-[#eee0d4] px-5 py-4">
            <RecordPager page={page} total={total} loading={loading} label="列表底部翻页" onPage={setPage} />
          </div>
        </div>
      </section>
    </main>
  );
}
