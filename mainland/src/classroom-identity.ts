import {
  archiveRequest,
  clearArchiveToken,
  getArchiveToken,
  getPendingAccess,
  setPendingAccess,
  type AccessRequest,
} from './archive-api';
import {
  getCourseIdentity,
  rememberCourseIdentity,
  rememberCourseStudent,
  type CourseIdentity,
} from './course-session';
import { projectSchoolRecord } from '@/lib/school-classes';

type Person = { name: string; className: string; studentNumber?: string };
const inFlight = new Map<string, Promise<CourseIdentity>>();
const samePerson = (a: Person, b: Person) =>
  a.name === b.name && a.className === b.className;

// Standalone task links share the same protected classroom identity as the hub.
// A new device can work immediately, but cannot read somebody's old archive.
export function ensureCoursePractice(
  submitted: Person,
): Promise<CourseIdentity> {
  const view = projectSchoolRecord({
    student_name: submitted.name,
    class_name: submitted.className,
  });
  const person = {
    ...submitted,
    name: view.student_name,
    className: view.class_name,
  };
  const key = `${person.name}|${person.className}`;
  const current = inFlight.get(key);
  if (current) return current;
  const work = (async () => {
    rememberCourseStudent(person);
    const identity = getCourseIdentity();
    const token = identity?.token || getArchiveToken();
    if (token) {
      try {
        const session = await archiveRequest<{
          student: CourseIdentity['student'];
          verified?: boolean;
          expiresAt: number;
        }>('courseSession', { studentToken: token });
        if (samePerson(session.student, person)) {
          const result = {
            token,
            student: session.student,
            verified: session.verified !== false,
            expiresAt: session.expiresAt,
          };
          rememberCourseIdentity(result);
          return result;
        }
      } catch (error) {
        if (
          !(error instanceof Error && 'status' in error && error.status === 401)
        )
          throw error;
      }
      clearArchiveToken();
    }
    const pending = getPendingAccess();
    if (pending && samePerson(pending, person)) {
      const status = await archiveRequest<{
        status: string;
        studentToken?: string;
        student?: CourseIdentity['student'];
        expiresAt?: number;
      }>('accessStatus', { requestToken: pending.requestToken });
      if (
        status.status === 'approved' &&
        status.studentToken &&
        status.student &&
        status.expiresAt
      ) {
        const granted = {
          token: status.studentToken,
          student: status.student,
          verified: true,
          expiresAt: Math.min(status.expiresAt, Date.now() + 7200000),
        };
        setPendingAccess(null);
        rememberCourseIdentity(granted);
        return granted;
      }
      if (status.status === 'pending') {
        const result = await archiveRequest<{
          practiceToken: string;
          practiceExpiresAt: number;
          student: CourseIdentity['student'];
        }>('startPractice', { requestToken: pending.requestToken });
        setPendingAccess({ ...pending, ...result });
        const practice = {
          token: result.practiceToken,
          student: result.student,
          verified: false,
          expiresAt: result.practiceExpiresAt,
        };
        rememberCourseIdentity(practice);
        return practice;
      }
    }
    setPendingAccess(null);
    const request = await archiveRequest<AccessRequest>('requestAccess', {
      name: person.name,
      className: person.className,
      practice: true,
    });
    if (
      !request.practiceToken ||
      !request.student ||
      !request.practiceExpiresAt
    )
      throw new Error('课堂身份尚未建立，请重试；原有档案未改变。');
    setPendingAccess({
      ...request,
      name: person.name,
      className: person.className,
      remember: false,
    });
    const practice = {
      token: request.practiceToken,
      student: request.student,
      verified: false,
      expiresAt: request.practiceExpiresAt,
    };
    rememberCourseIdentity(practice);
    return practice;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, work);
  return work;
}
