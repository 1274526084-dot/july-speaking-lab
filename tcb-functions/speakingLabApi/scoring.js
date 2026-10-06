/* oxlint-disable typescript/no-require-imports */
const rules = require('./scene-rules');
const normalize = text => String(text || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g,' ').trim();
function gradeSpeaking(sceneId, transcript) {
  const turns = rules[sceneId];
  if (!turns) throw new Error('Invalid scene');
  const responses = [...String(transcript || '').matchAll(/^Student · Round (\d): (.*)$/gm)];
  const texts = new Map(responses.map(match => [Number(match[1]), match[2]]));
  const missing = texts.size !== 3 || [1,2,3].some(round => !normalize(texts.get(round)) || /未返回识别|未识别|录音已保存/.test(texts.get(round)));
  const scores = turns.map((turn,index) => {
    const text = normalize(texts.get(index+1));
    const matched = new Set(turn.keywords.filter(word => text.includes(normalize(word))));
    const count = text.split(' ').filter(Boolean).length;
    return { task: Math.min(40, matched.size*20), sentence: (turn.patterns.some(pattern => text.includes(normalize(pattern))) ? 20 : 0) + (count >= 6 ? 10 : count >= 3 ? 5 : 0) };
  });
  const task = Math.round(scores.reduce((sum,row) => sum+row.task,0)/3);
  const sentence = Math.round(scores.reduce((sum,row) => sum+row.sentence,0)/3);
  const interaction = Math.round(Math.min(3,texts.size)/3*10);
  return { task_score: missing ? null : task, sentence_score: missing ? null : sentence, clarity_score: null, interaction_score: interaction, total_score: missing ? null : Math.round((task+sentence+interaction)/80*100), scoring_version: 'task-reference-v1', score_kind: 'practice-reference', requires_teacher_review: missing, feedback: missing ? '识别文字不完整，录音保留，待教师回听；未识别不判零分。' : '云端按任务信息、提示句型和话轮统一计算参考分；不评定专业发音或英语水平，教师可结合录音复核。' };
}
module.exports = { gradeSpeaking };
