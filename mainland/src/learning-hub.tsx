import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Headphones,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
} from 'lucide-react';
import { profilePath } from './profile-api';
import { sitePath } from './api';
import { wordPath } from './word-api';

const modules = [
  {
    number: '01',
    eyebrow: 'START HERE',
    title: '建立英语学习档案',
    description: '填写高考/单招英语起点、学习习惯、技能自评、专业选择和学习目标。',
    note: '建议第一次上课先完成',
    href: profilePath(),
    icon: UserRoundSearch,
    color: 'from-[#f7a56e] to-[#e85b15]',
    soft: 'bg-[#fff0e6]',
  },
  {
    number: '02',
    eyebrow: 'WORD SOUND',
    title: '单词跟读练习',
    description: '打开教师发布的单元，听标准示范、录音跟读、查看系统反馈并完成自评。',
    note: '单词表现进入综合成长画像',
    href: wordPath(),
    icon: Headphones,
    color: 'from-[#5773db] to-[#4239c9]',
    soft: 'bg-[#eef0ff]',
  },
  {
    number: '03',
    eyebrow: 'SPEAKING',
    title: '校园情景口语',
    description: '从四个校园场景中自主选择，按提示完成多轮对话、回听录音并获得建议。',
    note: '口语表现进入综合成长画像',
    href: sitePath('student'),
    icon: MessageCircleMore,
    color: 'from-[#62935a] to-[#356a36]',
    soft: 'bg-[#edf6e9]',
  },
];

export function LearningHub() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ffe1cc_0,transparent_34rem),radial-gradient(circle_at_90%_18%,#dfeeda_0,transparent_28rem),#fffaf5] px-4 py-6 text-[#273327] sm:px-7 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 rounded-[30px] border border-[#ebcdb8] bg-white/85 px-6 py-6 shadow-[0_24px_70px_rgba(90,55,29,.1)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-9">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#e95a0d] text-2xl font-black text-white shadow-lg shadow-orange-900/10">J</span>
            <div>
              <p className="text-xs font-black tracking-[.18em] text-[#42703b]">JULY ENGLISH LEARNING HUB</p>
              <h1 className="serif mt-1 text-2xl font-bold text-[#d74f0b] sm:text-3xl">学生英语学习平台</h1>
              <p className="mt-1 text-sm text-[#687168]">学情档案 · 单词跟读 · 情景口语</p>
            </div>
          </div>
          <a href={sitePath('workbench/login')} className="focus-ring inline-flex items-center justify-center gap-2 rounded-2xl border border-[#b9c9b4] bg-[#f7fbf5] px-5 py-3 font-bold text-[#416b36]">
            <BarChart3 className="h-5 w-5" />教师数据中心
          </a>
        </header>

        <section className="grid items-center gap-8 px-2 pb-9 pt-12 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff0e4] px-4 py-2 text-sm font-bold text-[#d84f0b]"><Sparkles className="h-4 w-4" />从英语起点到每一次开口</div>
            <h2 className="serif mt-5 max-w-3xl text-4xl font-bold leading-tight text-[#263528] sm:text-5xl">一个入口，完成你的<br /><span className="text-[#df570f]">英语学习成长记录</span></h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#667067] sm:text-lg">三个模块彼此独立、数据安全保存；使用相同的“姓名＋班级”后，单词和口语表现会自动汇入你的整体英语画像。</p>
          </div>
          <div className="rounded-[28px] border border-[#cad9c5] bg-[#f3f9ef] p-6 sm:p-8">
            <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#416b36] text-white"><ShieldCheck /></span><div><h3 className="text-lg font-black">进入前请记住</h3><p className="mt-2 leading-7 text-[#657064]">三个模块请填写完全一致的姓名和班级。系统只用于形成学习画像与教师反馈，不公开个人分数。</p></div></div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {modules.map(({ number, eyebrow, title, description, note, href, icon: Icon, color, soft }) => (
            <a key={number} href={href} className="group focus-ring flex min-h-[330px] flex-col rounded-[30px] border border-[#ead2c0] bg-white p-6 shadow-[0_18px_50px_rgba(82,55,34,.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(82,55,34,.13)] sm:p-7">
              <div className="flex items-start justify-between"><span className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${color} text-white shadow-lg`}><Icon className="h-7 w-7" /></span><span className="serif text-4xl font-bold text-[#eadacc]">{number}</span></div>
              <p className="mt-7 text-xs font-black tracking-[.16em] text-[#657b5e]">{eyebrow}</p>
              <h3 className="mt-2 text-2xl font-black text-[#2d372e]">{title}</h3>
              <p className="mt-4 flex-1 leading-7 text-[#6a716a]">{description}</p>
              <div className={`mt-5 flex items-center justify-between gap-3 rounded-2xl ${soft} px-4 py-3`}><small className="font-bold text-[#586459]">{note}</small><ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" /></div>
            </a>
          ))}
        </section>

        <section className="mt-8 rounded-[28px] border border-[#ead0bd] bg-[#fff5ec] p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
          <div className="flex items-start gap-4"><BookOpenCheck className="mt-1 h-7 w-7 shrink-0 text-[#e65a10]" /><div><h3 className="text-lg font-black">推荐完成顺序</h3><p className="mt-1 leading-7 text-[#697169]">先建立学习档案，再按教师在学习通发布的链接进入单词任务，最后完成校园情景口语练习。</p></div></div>
          <div className="mt-5 whitespace-nowrap rounded-full bg-white px-5 py-3 text-center text-sm font-black text-[#416b36] shadow-sm sm:mt-0">档案 → 单词 → 口语</div>
        </section>
        <footer className="py-8 text-center text-sm text-[#7b817a]">Liuzhou Railway Vocational Technical College · July English Lab</footer>
      </div>
    </main>
  );
}
