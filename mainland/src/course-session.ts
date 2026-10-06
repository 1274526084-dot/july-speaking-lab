import { projectSchoolRecord } from '@/lib/school-classes';
export const COURSE_SESSION_KEY = 'july.course.identity.v1';
const COURSE_STUDENT_KEY = 'july.course.student.v1';
type CourseStudent = {
  name: string;
  className: string;
  studentNumber?: string;
};
function normalizedStudent<T extends CourseStudent>(student: T): T {
  const view = projectSchoolRecord({
    student_name: student.name,
    class_name: student.className,
  });
  return { ...student, name: view.student_name, className: view.class_name };
}
export type CourseIdentity = {
  token: string;
  verified?: boolean;
  student: {
    id: string;
    name: string;
    className: string;
    studentNumber?: string;
  };
  expiresAt: number;
};
export function getCourseIdentity(): CourseIdentity | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(COURSE_SESSION_KEY) || 'null',
    );
    if (
      value?.expiresAt > Date.now() &&
      /^[a-f0-9]{64}$/.test(value.token) &&
      value.student?.name &&
      value.student?.className
    )
      return { ...value, student: normalizedStudent(value.student) };
    localStorage.removeItem(COURSE_SESSION_KEY);
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  return null;
}
export function rememberCourseIdentity(value: CourseIdentity) {
  localStorage.setItem(COURSE_SESSION_KEY, JSON.stringify(value));
}
// Name/class hints are not an archive credential and cannot read private records.
export function getCourseStudent(): CourseStudent | null {
  const identity = getCourseIdentity();
  if (identity) return identity.student;
  try {
    const hint = JSON.parse(localStorage.getItem(COURSE_STUDENT_KEY) || 'null');
    if (
      hint?.expiresAt > Date.now() &&
      hint.student?.name &&
      hint.student?.className
    )
      return normalizedStudent(hint.student);
    localStorage.removeItem(COURSE_STUDENT_KEY);
  } catch {
    /* Private mode may block storage. */
  }
  return null;
}
export function rememberCourseStudent(student: CourseStudent) {
  try {
    const previousStudent = getCourseStudent();
    const person = normalizedStudent({
      ...student,
      name: student.name.trim(),
      className: student.className.trim(),
    });
    if (
      !person.studentNumber &&
      previousStudent?.name === person.name &&
      previousStudent.className === person.className
    )
      person.studentNumber = previousStudent.studentNumber;
    const previous = getCourseIdentity();
    if (
      previous &&
      (previous.student.name !== person.name ||
        previous.student.className !== person.className)
    ) {
      clearCourseIdentity();
      sessionStorage.removeItem('july.archive.student-session.v1');
      localStorage.removeItem('july.archive.student-session.v1');
    }
    localStorage.setItem(
      COURSE_STUDENT_KEY,
      JSON.stringify({
        student: person,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      }),
    );
  } catch {
    /* Learning must remain usable when storage is unavailable. */
  }
}
export function clearCourseIdentity() {
  localStorage.removeItem(COURSE_SESSION_KEY);
  localStorage.removeItem(COURSE_STUDENT_KEY);
}
export function studentReturnUrl() {
  try {
    const value = new URLSearchParams(location.search).get('next');
    if (!value) return '';
    const url = new URL(value, location.origin);
    return url.origin === location.origin &&
      (/^\/july-Englishclass\/(pinglu-canal-english-quiz|irregular-verbs-game|english-tense-practice|school-writing-practice|writing-train|writing-signal|writing-energy)\.html$/.test(
        url.pathname,
      ) ||
        /^\/july-speaking-lab\/(student|words|profile)\/$/.test(url.pathname))
      ? url.href
      : '';
  } catch {
    return '';
  }
}
