import { type Unit2Summary } from './archive-api';
import './unit2-panel.css';
export const UNIT2_LINKS = [
  {
    id: 'pinglu',
    title: '平陆运河测试',
    subtitle: '先测一测 · 留下本课起点',
    file: 'pinglu-canal-english-quiz.html',
  },
  {
    id: 'verbs',
    title: '不规则动词游戏',
    subtitle: '练动词变化 · 巩固词形',
    file: 'irregular-verbs-game.html',
  },
  {
    id: 'tense',
    title: '时态练习',
    subtitle: '学完再练 · 检查时态应用',
    file: 'english-tense-practice.html',
  },
  {
    id: 'writing',
    title: '校园写作',
    subtitle: '信息填空 → 完整英文段落',
    file: 'school-writing-practice.html',
  },
];
export const unit2Href = (file: string) => `/july-Englishclass/${file}`;
const score = (value?: number | null) =>
  value == null ? '待完成' : `${value}分`;
export function Unit2Panel({
  data,
  links = true,
}: {
  data?: Unit2Summary;
  links?: boolean;
}) {
  const keys = UNIT2_LINKS.map((item) => item.id);
  const point = (index: number, radius: number) => {
    const a = (index * Math.PI) / 2 - Math.PI / 2;
    return [170 + Math.cos(a) * radius, 155 + Math.sin(a) * radius];
  };
  const polygon = (radius: number) =>
    keys.map((_, i) => point(i, radius).join(',')).join(' ');
  const values = keys.map((key) => data?.radar?.[key] ?? null);
  const complete = values.every((value) => value !== null);
  return (
    <section className="unit2-panel">
      <div className="unit2-heading">
        <div>
          <small>UNIT 1 · 第2课</small>
          <h2>本课作答明细</h2>
        </div>
        <span>{data?.completed || 0} / 4 项完成</span>
      </div>
      <div className="unit2-grid">
        <div className="unit2-stages">
          {UNIT2_LINKS.map((item, i) => {
            const stage = data?.stages?.[item.id];
            const value = data?.radar?.[item.id];
            return (
              <article key={item.id}>
                <b>{String(i + 1).padStart(2, '0')}</b>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.subtitle}</p>
                  <strong>{score(value)}</strong>
                  {stage && (
                    <small>
                      首次 {stage.first} · 最近 {stage.latest} · 最好{' '}
                      {stage.best} · 共 {stage.attempts} 次
                    </small>
                  )}
                  {item.id === 'writing' && (
                    <small>
                      课堂 {score(data?.stages?.writingClass?.latest)} · 作文{' '}
                      {score(data?.stages?.writingEssay?.latest)}
                    </small>
                  )}
                </div>
                {links && <a href={unit2Href(item.file)}>进入练习 →</a>}
              </article>
            );
          })}
        </div>
        <div className="unit2-evidence">
          <h3>本课练习雷达 · 满分100</h3>
          <svg
            viewBox="0 0 340 310"
            aria-label={`第二课练习成绩：${UNIT2_LINKS.map((item, i) => `${item.title}${score(values[i])}`).join('，')}`}
          >
            {[25, 50, 75, 100].map((v) => (
              <polygon
                key={v}
                points={polygon(v)}
                fill="none"
                stroke="#cddcd5"
              />
            ))}
            {keys.map((key, i) => {
              const p = point(i, 100),
                label = point(i, 135);
              return (
                <g key={key}>
                  <line
                    x1="170"
                    y1="155"
                    x2={p[0]}
                    y2={p[1]}
                    stroke="#cddcd5"
                  />
                  <text
                    x={label[0]}
                    y={label[1]}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="12"
                    fill="#365749"
                  >
                    {UNIT2_LINKS[i].title}
                  </text>
                </g>
              );
            })}
            {complete && (
              <polygon
                points={values.map((v, i) => point(i, v!).join(',')).join(' ')}
                fill="#2b8c7444"
                stroke="#237860"
                strokeWidth="3"
              />
            )}
            {values.map(
              (v, i) =>
                v !== null && (
                  <circle
                    key={keys[i]}
                    cx={point(i, v)[0]}
                    cy={point(i, v)[1]}
                    r="5"
                    fill="#237860"
                  />
                ),
            )}
          </svg>
          <p>
            有记录的项目显示圆点；四项齐全后连成雷达面。写作为课堂填空与作文的平均得分率。
          </p>
          <div className="unit2-change">
            <span>
              课前首次
              <br />
              <strong>{score(data?.pretest)}</strong>
            </span>
            <span>
              练习后时态
              <br />
              <strong>{score(data?.postPractice)}</strong>
            </span>
            <span>
              差值
              <br />
              <strong>
                {data?.change == null
                  ? '待比较'
                  : `${data.change > 0 ? '+' : ''}${data.change}分`}
              </strong>
            </span>
          </div>
          <small>
            两次题目不同，差值用于课堂复盘。作文按任务规则辅助评分，老师可结合原文复核。
          </small>
        </div>
      </div>
    </section>
  );
}
