/* oxlint-disable next/no-html-link-for-pages, jsx-a11y/media-has-caption */
import { BarChart3, Download, Headphones, LoaderCircle, LogOut, MessageSquareText, Search, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type AudioMeta = { key: string; type: string; size: number; round: number };

type AttemptRow = {
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

function parseAudio(value: string | null): AudioMeta[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as AudioMeta[];
    return Array.isArray(parsed) ? parsed.filter((item) => Boolean(item?.key)) : [];
  } catch {
    return [];
  }
}

function normalizeKeyword(value: string) {
  return value.toLocaleLowerCase('zh-CN').replace(/[\s_-]+/g, '');
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return <div className="rounded-3xl border border-[#e6d2c1] bg-white p-5 shadow-soft">{icon}<p className="mt-3 text-3xl font-black">{value}</p><p className="mt-1 text-sm text-[#687168]">{label}</p></div>;
}

export function TeacherApp() {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [classKeyword, setClassKeyword] = useState('');

  useEffect(() => {
    void fetch('/api/attempts', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.replace('/teacher/login/');
          return null;
        }
        if (!response.ok) throw new Error('load failed');
        return response.json() as Promise<{ rows: AttemptRow[] }>;
      })
      .then((payload) => { if (payload) setRows(payload.rows || []); })
      .catch(() => setError('学生数据暂时无法加载，请稍后刷新。'))
      .finally(() => setLoading(false));
  }, []);

  const normalizedKeyword = normalizeKeyword(classKeyword.trim());
  const classGroups = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(row.class_name, (counts.get(row.class_name) ?? 0) + 1));
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right, 'zh-CN'));
  }, [rows]);
  const filteredRows = useMemo(() => normalizedKeyword
    ? rows.filter((row) => normalizeKeyword(row.class_name).includes(normalizedKeyword))
    : rows, [normalizedKeyword, rows]);

  const scoredRows = rows.filter((row) => row.total_score !== null);
  const studentCount = new Set(rows.map((row) => row.student_id)).size;
  const recordingCount = rows.filter((row) => parseAudio(row.audio_manifest).length > 0).length;
  const averageScore = scoredRows.length
    ? Math.round(scoredRows.reduce((sum, row) => sum + Number(row.total_score), 0) / scoredRows.length)
    : 0;

  async function logout() {
    await fetch('/api/teacher-logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    window.location.replace('/teacher/login/');
  }

  return (
    <main className="min-h-screen pb-12">
      <header className="glass sticky top-0 z-20 border-b border-[#ecd3bf]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4">
          <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#416b36]">July English Lab</p><h1 className="serif text-2xl font-bold text-[#d94f08]">教师口语数据</h1></div>
          <div className="flex gap-2">
            <a href="/api/export" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-[#416b36] px-4 py-2.5 text-sm font-bold text-white"><Download className="h-4 w-4" /> <span className="hidden sm:inline">导出CSV</span></a>
            <button onClick={() => void logout()} className="focus-ring grid h-10 w-10 place-items-center rounded-xl border border-[#dec8b4] bg-white text-[#687168]" aria-label="退出教师端"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 pt-7">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Users className="h-5 w-5 text-[#ea5a0b]" />} value={studentCount} label="提交学生" />
          <Metric icon={<MessageSquareText className="h-5 w-5 text-[#ea5a0b]" />} value={rows.length} label="练习记录" />
          <Metric icon={<BarChart3 className="h-5 w-5 text-[#ea5a0b]" />} value={scoredRows.length ? `${averageScore}分` : '—'} label="平均得分" />
          <Metric icon={<Headphones className="h-5 w-5 text-[#ea5a0b]" />} value={recordingCount} label="可回听记录" />
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-[#e2cebd] bg-white shadow-soft">
          <div className="border-b border-[#eee0d4] px-5 py-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><h2 className="font-bold">最近300条记录</h2><p className="mt-1 text-sm text-[#7a7168]">点击每轮录音即可回听；评分为任务型学习反馈，不是专业语音测评。</p></div>
              <p aria-live="polite" className="rounded-full bg-[#edf6f8] px-3 py-1.5 text-sm font-bold text-[#315f6b]">显示 {filteredRows.length} / {rows.length} 条</p>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(280px,440px)_1fr] lg:items-start">
              <label className="relative block">
                <span className="sr-only">按班级关键词筛选</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7b746c]" />
                <input type="search" value={classKeyword} onChange={(event) => setClassKeyword(event.target.value)} placeholder="输入班级关键词，如：城轨信号、2401、储能" className="focus-ring h-12 w-full rounded-2xl border border-[#d9c4b2] bg-[#fffaf6] pl-11 pr-11 text-base text-[#332b25] placeholder:text-[#9a9189]" />
                {classKeyword && <button type="button" onClick={() => setClassKeyword('')} aria-label="清除班级筛选" className="focus-ring absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#7b746c] hover:bg-[#f1e7de]"><X className="h-4 w-4" /></button>}
              </label>
              <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto" aria-label="班级快捷筛选">
                <button type="button" onClick={() => setClassKeyword('')} className={`focus-ring rounded-full border px-3 py-2 text-sm font-bold ${!classKeyword ? 'border-[#416b36] bg-[#416b36] text-white' : 'border-[#d8c5b5] bg-white text-[#655c54]'}`}>全部 · {rows.length}</button>
                {classGroups.map(([className, count]) => {
                  const active = normalizeKeyword(classKeyword) === normalizeKeyword(className);
                  return <button key={className} type="button" onClick={() => setClassKeyword(className)} className={`focus-ring rounded-full border px-3 py-2 text-sm font-bold ${active ? 'border-[#ea5a0b] bg-[#fff0e4] text-[#c94a07]' : 'border-[#d8c5b5] bg-white text-[#655c54]'}`}>{className} · {count}</button>;
                })}
              </div>
            </div>
          </div>

          {loading && <div className="flex items-center justify-center gap-3 px-5 py-20 text-[#687168]"><LoaderCircle className="h-5 w-5 animate-spin" /> 正在加载学生数据…</div>}
          {error && <div role="alert" className="px-5 py-16 text-center font-bold text-[#b33d08]">{error}</div>}
          {!loading && !error && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1380px] border-collapse text-left text-sm">
                <thead className="bg-[#fff4ea] text-[#67584c]"><tr>{['提交时间', '学生', '班级', '场景', '总分', '分项得分', '录音', '对话文本', '系统建议'].map((heading) => <th key={heading} className="px-4 py-3 font-bold">{heading}</th>)}</tr></thead>
                <tbody>{filteredRows.map((row) => {
                  const clips = parseAudio(row.audio_manifest);
                  return <tr key={row.id} className="border-t border-[#f0e4da] align-top hover:bg-[#fffbf7]">
                    <td className="whitespace-nowrap px-4 py-4 text-[#687168]">{new Date(row.submitted_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td>
                    <td className="px-4 py-4"><p className="font-bold">{row.student_name}</p><p className="text-xs text-[#7a7168]">{row.student_id}</p></td>
                    <td className="px-4 py-4">{row.class_name}</td><td className="px-4 py-4 font-bold text-[#416b36]">{row.scene_title}</td>
                    <td className="px-4 py-4 text-xl font-black text-[#d94f08]">{row.total_score ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-4 leading-6">任务 {row.task_score ?? '—'}/40<br />句型 {row.sentence_score ?? '—'}/30<br />清晰 {row.clarity_score ?? '—'}/20<br />话轮 {row.interaction_score ?? '—'}/10</td>
                    <td className="min-w-72 px-4 py-4"><div className="space-y-2">{clips.length ? clips.map((clip, index) => <div key={clip.key} className="flex items-center gap-2"><span className="w-12 text-xs font-bold">第{clip.round}轮</span><audio controls preload="none" src={`/api/audio?attempt=${encodeURIComponent(row.id)}&clip=${index}`} className="h-9 w-52" /></div>) : <span className="text-[#8a837c]">无录音</span>}</div></td>
                    <td className="max-w-md whitespace-pre-line px-4 py-4 leading-6 text-[#59645a]">{row.transcript}</td><td className="max-w-sm px-4 py-4 leading-6 text-[#59645a]">{row.feedback || '—'}</td>
                  </tr>;
                })}</tbody>
              </table>
              {rows.length === 0 && <div className="px-5 py-16 text-center text-[#7a7168]">还没有学生提交练习。</div>}
              {rows.length > 0 && filteredRows.length === 0 && <div className="px-5 py-16 text-center"><p className="font-bold text-[#59645a]">没有找到包含“{classKeyword.trim()}”的班级</p><button type="button" onClick={() => setClassKeyword('')} className="focus-ring mt-3 rounded-xl bg-[#416b36] px-4 py-2.5 text-sm font-bold text-white">查看全部记录</button></div>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
