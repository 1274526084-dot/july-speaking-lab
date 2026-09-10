import { isTeacher, listAttempts } from '../_shared.js';

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function onRequestGet({ request }) {
  if (!(await isTeacher(request))) return new Response('Unauthorized', { status: 401 });
  const rows = await listAttempts(2000);
  const headers = ['提交时间', '姓名', '学号', '班级', '场景', '任务信息/40', '句型使用/30', '识别清晰度/20', '话轮完成/10', '总分/100', '用时秒', '录制次数', '对话文本', '系统建议', '录音状态'];
  const body = rows.map((row) => [
    new Date(Number(row.submitted_at)).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
    row.student_name, row.student_id, row.class_name, row.scene_title,
    row.task_score, row.sentence_score, row.clarity_score, row.interaction_score, row.total_score,
    row.duration_seconds, row.attempts, row.transcript, row.feedback, row.audio_manifest ? '有录音' : '无录音',
  ].map(csvCell).join(','));
  const csv = '\uFEFF' + [headers.map(csvCell).join(','), ...body].join('\r\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="speaking-attempts.csv"',
      'cache-control': 'no-store',
    },
  });
}

export function onRequest() {
  return new Response('Method not allowed', { status: 405, headers: { allow: 'GET' } });
}
