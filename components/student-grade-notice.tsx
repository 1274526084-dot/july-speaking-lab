import styles from './student-grade-notice.module.css';

export function StudentGradeNotice({ survey = false }: { survey?: boolean }) {
  return (
    <aside className={styles.notice} aria-label="成绩与本人身份提醒">
      <strong>成绩与平时分相关，请使用本人身份</strong>
      <p>练习成绩将记录，供任课教师评定平时成绩参考。</p>
      <p>
        请使用本人真实姓名和正确班级，前后保持一致；不要填写他人姓名或进入他人账号。
      </p>
      {survey && <p>本页学情自评不直接计入练习成绩。</p>}
    </aside>
  );
}
