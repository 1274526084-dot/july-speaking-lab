/* oxlint-disable next/no-html-link-for-pages, jsx-a11y/media-has-caption */
import { BarChart3, Download, Headphones, LogOut, MessageSquareText, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { requireChatGPTUser, chatGPTSignOutPath } from '@/app/chatgpt-auth';
import { getDb, getTeacherEmail } from '@/lib/db';

export const dynamic = 'force-dynamic';

type AudioMeta = { key: string; type: string; size: number; round: number };
type AttemptRow = {
  id: string; student_name: string; student_id: string; class_name: string; scene_title: string;
  transcript: string; task_score: number | null; sentence_score: number | null; clarity_score: number | null;
  interaction_score: number | null; total_score: number | null; feedback: string | null; audio_manifest: string | null;
  duration_seconds: number; attempts: number; submitted_at: number;
};

function parseAudio(value: string | null): AudioMeta[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as AudioMeta[];
    return Array.isArray(parsed) ? parsed.filter((item) => Boolean(item?.key)) : [];
  } catch { return []; }
}

async function TeacherDashboard() {
  const user = await requireChatGPTUser('/teacher');
  const allowedEmail = getTeacherEmail();
  if (!allowedEmail || user.email.toLowerCase() !== allowedEmail) {
    return <main className="grid min-h-screen place-items-center px-5"><div className="max-w-lg rounded-3xl border border-[#e4c8b1] bg-white p-8 text-center shadow-soft"><h1 className="serif text-3xl font-bold text-[#d94f08]">教师页面未授权</h1><p className="mt-3 leading-7 text-[#687168]">学生数据和录音仅向课程教师开放。请使用已绑定的教师账号登录。</p><a href={chatGPTSignOutPath('/teacher')} target="_top" className="mt-5 inline-flex rounded-xl bg-[#416b36] px-5 py-3 font-bold text-white">退出并重新登录</a></div></main>;
  }

  const query = await getDb().prepare(`
    SELECT id, student_name, student_id, class_name, scene_title, transcript,
           task_score, sentence_score, clarity_score, interaction_score, total_score,
           feedback, audio_manifest, duration_seconds, attempts, submitted_at
    FROM speaking_attempts ORDER BY submitted_at DESC LIMIT 300
  `).all<AttemptRow>();
  const rows = query.results ?? [];
  const scoredRows = rows.filter((row) => row.total_score !== null);
  const studentCount = new Set(rows.map((row) => row.student_id)).size;
  const recordingCount = rows.filter((row) => parseAudio(row.audio_manifest).length > 0).length;
  const averageScore = scoredRows.length ? Math.round(scoredRows.reduce((sum, row) => sum + Number(row.total_score), 0) / scoredRows.length) : 0;
  const metrics: Array<{ Icon: LucideIcon; value: string | number; label: string }> = [
    { Icon: Users, value: studentCount, label: '提交学生' },
    { Icon: MessageSquareText, value: rows.length, label: '练习记录' },
    { Icon: BarChart3, value: scoredRows.length ? `${averageScore}分` : '—', label: '平均得分' },
    { Icon: Headphones, value: recordingCount, label: '可回听记录' },
  ];

  return (
    <main className="min-h-screen pb-12">
      <header className="glass sticky top-0 z-20 border-b border-[#ecd3bf]"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#416b36]">July English Lab</p><h1 className="serif text-2xl font-bold text-[#d94f08]">教师口语数据</h1></div><div className="flex gap-2"><a href="/api/attempts/export" className="inline-flex items-center gap-2 rounded-xl bg-[#416b36] px-4 py-2.5 text-sm font-bold text-white"><Download className="h-4 w-4" /> 导出CSV</a><a href={chatGPTSignOutPath('/teacher')} target="_top" className="grid h-10 w-10 place-items-center rounded-xl border border-[#dec8b4] bg-white text-[#687168]" aria-label="退出"><LogOut className="h-4 w-4" /></a></div></div></header>
      <section className="mx-auto max-w-7xl px-5 pt-7">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(({ Icon, value, label }) => <div key={label} className="rounded-3xl border border-[#e6d2c1] bg-white p-5 shadow-soft"><Icon className="h-5 w-5 text-[#ea5a0b]" /><p className="mt-3 text-3xl font-black">{value}</p><p className="mt-1 text-sm text-[#687168]">{label}</p></div>)}</div>
        <div className="mt-5 overflow-hidden rounded-3xl border border-[#e2cebd] bg-white shadow-soft"><div className="border-b border-[#eee0d4] px-5 py-4"><h2 className="font-bold">最近300条记录</h2><p className="mt-1 text-sm text-[#7a7168]">点击每轮录音即可回听；评分为任务型学习反馈，不是专业语音测评。</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1380px] border-collapse text-left text-sm"><thead className="bg-[#fff4ea] text-[#67584c]"><tr>{['提交时间', '学生', '班级', '场景', '总分', '分项得分', '录音', '对话文本', '系统建议'].map((heading) => <th key={heading} className="px-4 py-3 font-bold">{heading}</th>)}</tr></thead><tbody>{rows.map((row) => { const clips = parseAudio(row.audio_manifest); return <tr key={row.id} className="border-t border-[#f0e4da] align-top hover:bg-[#fffbf7]"><td className="whitespace-nowrap px-4 py-4 text-[#687168]">{new Date(row.submitted_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td><td className="px-4 py-4"><p className="font-bold">{row.student_name}</p><p className="text-xs text-[#7a7168]">{row.student_id}</p></td><td className="px-4 py-4">{row.class_name}</td><td className="px-4 py-4 font-bold text-[#416b36]">{row.scene_title}</td><td className="px-4 py-4 text-xl font-black text-[#d94f08]">{row.total_score ?? '—'}</td><td className="whitespace-nowrap px-4 py-4 leading-6">任务 {row.task_score ?? '—'}/40<br />句型 {row.sentence_score ?? '—'}/30<br />清晰 {row.clarity_score ?? '—'}/20<br />话轮 {row.interaction_score ?? '—'}/10</td><td className="min-w-72 px-4 py-4"><div className="space-y-2">{clips.length ? clips.map((clip, index) => <div key={clip.key} className="flex items-center gap-2"><span className="w-12 text-xs font-bold">第{clip.round}轮</span><audio controls preload="none" src={`/api/audio?attempt=${encodeURIComponent(row.id)}&clip=${index}`} className="h-9 w-52" /></div>) : <span className="text-[#8a837c]">无录音</span>}</div></td><td className="max-w-md whitespace-pre-line px-4 py-4 leading-6 text-[#59645a]">{row.transcript}</td><td className="max-w-sm px-4 py-4 leading-6 text-[#59645a]">{row.feedback || '—'}</td></tr>; })}</tbody></table>{rows.length === 0 && <div className="px-5 py-16 text-center text-[#7a7168]">还没有学生提交练习。</div>}</div></div>
      </section>
    </main>
  );
}

export default function TeacherPage() { return <TeacherDashboard />; }
