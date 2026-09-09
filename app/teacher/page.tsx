import { BarChart3, Download, LogOut, MessageSquareText, Timer, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { requireChatGPTUser, chatGPTSignOutPath } from '@/app/chatgpt-auth';
import { getDb, getTeacherEmail } from '@/lib/db';

export const dynamic = 'force-dynamic';

type AttemptRow = {
  id: string; student_name: string; student_id: string; class_name: string; scene_title: string;
  transcript: string; coverage: number; confidence: number | null; duration_seconds: number; attempts: number; submitted_at: number;
};

async function TeacherDashboard() {
  const user = await requireChatGPTUser('/teacher');
  const allowedEmail = getTeacherEmail();
  if (!allowedEmail || user.email.toLowerCase() !== allowedEmail) {
    return <main className="grid min-h-screen place-items-center px-5"><div className="max-w-lg rounded-3xl border border-[#e4c8b1] bg-white p-8 text-center shadow-soft"><h1 className="serif text-3xl font-bold text-[#d94f08]">教师页面未授权</h1><p className="mt-3 leading-7 text-[#687168]">此账号不能查看学生练习数据。请使用课程教师的 ChatGPT 账号登录。</p><Link href={chatGPTSignOutPath('/teacher')} target="_top" className="mt-5 inline-flex rounded-xl bg-[#416b36] px-5 py-3 font-bold text-white">退出并重新登录</Link></div></main>;
  }

  const result = await getDb().prepare(`
    SELECT id, student_name, student_id, class_name, scene_title, transcript,
           coverage, confidence, duration_seconds, attempts, submitted_at
    FROM speaking_attempts
    ORDER BY submitted_at DESC
    LIMIT 300
  `).all<AttemptRow>();
  const rows = result.results ?? [];
  const studentCount = new Set(rows.map((row) => row.student_id)).size;
  const avgCoverage = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.coverage, 0) / rows.length) : 0;
  const avgDuration = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.duration_seconds, 0) / rows.length) : 0;
  const metrics: Array<{ Icon: LucideIcon; value: string | number; label: string }> = [
    { Icon: Users, value: studentCount, label: '已提交学生' },
    { Icon: MessageSquareText, value: rows.length, label: '练习记录' },
    { Icon: BarChart3, value: `${avgCoverage}%`, label: '平均关键词覆盖' },
    { Icon: Timer, value: `${avgDuration}s`, label: '平均用时' },
  ];

  return (
    <main className="min-h-screen pb-16">
      <header className="glass sticky top-0 z-20 border-b border-[#ecd3bf]"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#416b36]">July English Lab</p><h1 className="serif text-2xl font-bold text-[#d94f08]">教师口语数据看板</h1></div><div className="flex gap-2"><Link href="/api/attempts/export" className="inline-flex items-center gap-2 rounded-xl bg-[#416b36] px-4 py-2.5 text-sm font-bold text-white"><Download className="h-4 w-4" /> 导出CSV</Link><Link href={chatGPTSignOutPath('/teacher')} target="_top" className="grid h-10 w-10 place-items-center rounded-xl border border-[#dec8b4] bg-white text-[#687168]" aria-label="退出"><LogOut className="h-4 w-4" /></Link></div></div></header>
      <section className="mx-auto max-w-7xl px-5 pt-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ Icon, value, label }) => <div key={label} className="rounded-3xl border border-[#e6d2c1] bg-white/90 p-5 shadow-soft"><Icon className="h-5 w-5 text-[#ea5a0b]" /><p className="mt-4 text-3xl font-black text-[#273327]">{value}</p><p className="mt-1 text-sm text-[#687168]">{label}</p></div>)}
        </div>
        <div className="mt-6 overflow-hidden rounded-3xl border border-[#e2cebd] bg-white shadow-soft">
          <div className="border-b border-[#eee0d4] px-5 py-4"><h2 className="font-bold">最近300条记录</h2><p className="mt-1 text-xs text-[#7a7168]">不保存原始录音。识别置信度和关键词覆盖仅作学习反馈参考。</p></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="bg-[#fff4ea] text-[#67584c]"><tr>{['提交时间', '姓名 / 学号', '班级', '场景', '覆盖', '识别', '用时', '次数', '识别文本'].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead>
              <tbody>{rows.map((row) => <tr key={row.id} className="border-t border-[#f0e4da] align-top hover:bg-[#fffbf7]"><td className="whitespace-nowrap px-4 py-4 text-[#687168]">{new Date(row.submitted_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td><td className="px-4 py-4"><p className="font-bold">{row.student_name}</p><p className="text-xs text-[#7a7168]">{row.student_id}</p></td><td className="px-4 py-4">{row.class_name}</td><td className="px-4 py-4 font-semibold text-[#416b36]">{row.scene_title}</td><td className="px-4 py-4 font-bold text-[#d94f08]">{row.coverage}%</td><td className="px-4 py-4">{row.confidence === null ? '—' : `${row.confidence}%`}</td><td className="px-4 py-4">{row.duration_seconds}s</td><td className="px-4 py-4">{row.attempts}</td><td className="max-w-md px-4 py-4 leading-6 text-[#59645a]">{row.transcript}</td></tr>)}</tbody>
            </table>
            {rows.length === 0 && <div className="px-5 py-16 text-center text-[#7a7168]">还没有学生提交练习。</div>}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function TeacherPage() { return <TeacherDashboard />; }
