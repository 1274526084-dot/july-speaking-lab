import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getDb, getTeacherEmail } from '@/lib/db';

export const dynamic = 'force-dynamic';
type Row = Record<string, string | number | null>;

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user || !getTeacherEmail() || user.email.toLowerCase() !== getTeacherEmail()) return new Response('Unauthorized', { status: 401 });
  const result = await getDb().prepare(`
    SELECT submitted_at, student_name, student_id, class_name, scene_title,
           task_score, sentence_score, clarity_score, interaction_score, total_score,
           duration_seconds, attempts, transcript, feedback, audio_manifest
    FROM speaking_attempts ORDER BY submitted_at DESC
  `).all<Row>();
  const headers = ['提交时间', '姓名', '学号', '班级', '场景', '任务信息/40', '句型使用/30', '识别清晰度/20', '话轮完成/10', '总分/100', '用时秒', '录制次数', '对话文本', '系统建议', '录音状态'];
  const body = (result.results ?? []).map((row) => [
    new Date(Number(row.submitted_at)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }), row.student_name, row.student_id, row.class_name,
    row.scene_title, row.task_score, row.sentence_score, row.clarity_score, row.interaction_score, row.total_score,
    row.duration_seconds, row.attempts, row.transcript, row.feedback, row.audio_manifest ? '有录音' : '无录音',
  ].map(csvCell).join(','));
  const csv = '\uFEFF' + [headers.map(csvCell).join(','), ...body].join('\r\n');
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="speaking-attempts.csv"' } });
}
