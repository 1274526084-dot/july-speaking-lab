import { KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { getProfileTeacherToken, profilePath, profileRequest, setProfileTeacherToken } from './profile-api';

export function ProfileTeacherLogin() {
  const [code, setCode] = useState('July');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getProfileTeacherToken();
    if (!token) return;
    void profileRequest<{ ok: boolean }>('session', {}, token)
      .then(() => window.location.replace(profilePath('teacher')))
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true); setError('');
    try {
      const result = await profileRequest<{ ok: boolean; token?: string }>('teacherLogin', { code, password });
      if (!result.token) throw new Error('登录失败，请重试。');
      setProfileTeacherToken(result.token);
      window.location.replace(profilePath('teacher'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '暂时无法登录，请检查网络后重试。');
    } finally { setLoading(false); }
  }

  return (
    <main className="profile-login-page">
      <section className="profile-login-card">
        <div className="login-hero">
          <span className="login-icon"><LockKeyhole /></span>
          <p className="eyebrow">JULY · ENGLISH PROFILE</p>
          <h1>教师数据登录</h1>
          <p>查看班级实时统计和每位学生的英语学习档案。</p>
        </div>
        <form onSubmit={submit}>
          <label className="login-field"><span>教师账号</span><span className="login-control"><UserRound /><input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="username" /></span></label>
          <label className="login-field"><span>密码</span><span className="login-control"><KeyRound /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="请输入教师密码" /></span></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button full" disabled={loading || !code || !password}>{loading ? <LoaderCircle className="spin" /> : <ShieldCheck />}{loading ? '正在验证…' : '进入教师工作台'}</button>
          <a href={profilePath()} className="back-student">返回学生档案入口</a>
        </form>
      </section>
    </main>
  );
}
