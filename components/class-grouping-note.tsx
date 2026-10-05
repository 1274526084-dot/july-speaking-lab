import type { ClassGroup } from '@/lib/class-groups';

export function ClassGroupingNote({ groups }: { groups: ClassGroup[] }) {
  const combined = groups.filter(group => group.aliases.length > 1);
  const pending = groups.filter(group => group.ambiguous);
  return (
    <details style={{ margin: '12px 0', border: '1px solid #d8dfda', borderRadius: 12, padding: '12px 16px', background: '#f7faf8', fontSize: 14, color: '#47544b' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>班级智能归类 · {combined.length}组已合并写法{pending.length ? ` · ${pending.length}组待确认` : ''}</summary>
      <p style={{ marginTop: 8 }}>筛选、统计和导出使用学校的标准班级名称，原填姓名、班级、成绩和录音不被覆盖。无法可靠归类的记录进入“默认班级（测试）”，但不会因此合并为同一个学生。</p>
      {combined.map(group => <p key={group.key} style={{ marginTop: 6 }}><strong>{group.label}</strong> ← {group.aliases.join('、')}</p>)}
      {pending.map(group => <p key={group.key} style={{ marginTop: 6, color: '#9a5b17' }}><strong>{group.label}</strong>：{group.aliases.join('、')}</p>)}
    </details>
  );
}
