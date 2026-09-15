import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarRange,
  ChevronRight,
  Clock3,
  Headphones,
  Layers3,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
} from 'lucide-react';
import { sitePath } from './api';
import { profilePath } from './profile-api';
import { wordPath } from './word-api';

const semesterModules = [
  {
    eyebrow: 'SEMESTER PROFILE',
    title: '英语学习档案',
    description: '学期初建立英语起点、学习习惯和目标；学期中可以再次进入，更新自己的学习状态。',
    action: '建立或更新档案',
    note: '贯穿整学期 · 同一学生自动更新',
    href: profilePath(),
    icon: UserRoundSearch,
    color: 'from-[#f6a16a] to-[#e45710]',
    soft: 'bg-[#fff0e6]',
  },
  {
    eyebrow: 'UNIT WORDS',
    title: '每课单词跟读',
    description: '每学习一个新单元，教师都会发布新的单词任务。听示范、录音跟读、查看反馈并完成自评。',
    action: '进入单词任务',
    note: '每课更新 · 请从学习通进入对应单元',
    href: wordPath(),
    icon: Headphones,
    color: 'from-[#657be0] to-[#4840c9]',
    soft: 'bg-[#eef0ff]',
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
              <p className="mt-1 text-sm text-[#687168]">学期学习主线 · 分单元学习任务</p>
            </div>
          </div>
          <a href={sitePath('workbench/login')} className="focus-ring inline-flex items-center justify-center gap-2 rounded-2xl border border-[#b9c9b4] bg-[#f7fbf5] px-5 py-3 font-bold text-[#416b36]">
            <BarChart3 className="h-5 w-5" />教师数据中心
          </a>
        </header>

        <section className="grid items-center gap-8 px-2 pb-9 pt-12 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff0e4] px-4 py-2 text-sm font-bold text-[#d84f0b]"><Sparkles className="h-4 w-4" />一学期的英语成长记录</div>
            <h2 className="serif mt-5 max-w-3xl text-4xl font-bold leading-tight text-[#263528] sm:text-5xl">先完成学期主线，<br /><span className="text-[#df570f]">再进入当前单元任务</span></h2>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#667067] sm:text-lg">学情档案和单词跟读贯穿整个学期；听说读写等课堂活动按 Unit 逐步发布。每项任务都有独立页面，学习记录会汇入整体英语画像。</p>
          </div>
          <div className="rounded-[28px] border border-[#cad9c5] bg-[#f3f9ef] p-6 sm:p-8">
            <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#416b36] text-white"><ShieldCheck /></span><div><h3 className="text-lg font-black">数据匹配提醒</h3><p className="mt-2 leading-7 text-[#657064]">所有任务请填写完全一致的姓名和班级。三个模块独立保存，教师可以在综合画像中查看你的成长变化。</p></div></div>
          </div>
        </section>

        <section aria-labelledby="semester-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-black tracking-[.16em] text-[#d9550f]">01 · SEMESTER ROUTINE</p><h2 id="semester-title" className="mt-1 text-2xl font-black sm:text-3xl">学期学习主线</h2><p className="mt-2 text-[#6b746c]">从开学到期末持续使用，不属于某一节课。</p></div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#eaf4e6] px-4 py-2 text-sm font-black text-[#416b36]"><CalendarRange className="h-4 w-4" />全学期</span>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {semesterModules.map(({ eyebrow, title, description, action, note, href, icon: Icon, color, soft }) => (
              <a key={title} href={href} className="group focus-ring rounded-[30px] border border-[#ead2c0] bg-white p-6 shadow-[0_18px_50px_rgba(82,55,34,.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(82,55,34,.13)] sm:p-7">
                <div className="flex items-start gap-5"><span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${color} text-white shadow-lg`}><Icon className="h-7 w-7" /></span><div><p className="text-xs font-black tracking-[.16em] text-[#657b5e]">{eyebrow}</p><h3 className="mt-2 text-2xl font-black">{title}</h3></div></div>
                <p className="mt-5 min-h-[84px] leading-7 text-[#6a716a]">{description}</p>
                <div className={`mt-5 flex items-center justify-between gap-3 rounded-2xl ${soft} px-4 py-3`}><div><small className="block font-bold text-[#697269]">{note}</small><strong className="mt-1 block text-[#364437]">{action}</strong></div><ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" /></div>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="unit-title">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-black tracking-[.16em] text-[#4f61c9]">02 · UNIT ACTIVITIES</p><h2 id="unit-title" className="mt-1 text-2xl font-black sm:text-3xl">分单元学习任务</h2><p className="mt-2 text-[#6b746c]">每个 Unit 会根据课堂内容增加不同的听、说、读、写活动。</p></div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#eef0ff] px-4 py-2 text-sm font-black text-[#514bcf]"><Layers3 className="h-4 w-4" />按课程进度开放</span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
            <a href={sitePath('student')} className="group focus-ring overflow-hidden rounded-[30px] border border-[#cbd9c6] bg-white shadow-[0_18px_50px_rgba(59,92,55,.1)] transition hover:-translate-y-1 hover:shadow-xl">
              <div className="grid h-full md:grid-cols-[190px_1fr]">
                <div className="flex flex-col justify-between bg-gradient-to-br from-[#426f39] to-[#315b34] p-6 text-white sm:p-7"><div><p className="text-xs font-black tracking-[.18em] text-green-100">CURRENT UNIT</p><strong className="serif mt-2 block text-5xl">Unit 1</strong></div><MessageCircleMore className="mt-10 h-14 w-14 text-green-100/75" /></div>
                <div className="flex flex-col p-6 sm:p-8"><span className="w-fit rounded-full bg-[#eaf4e6] px-3 py-1.5 text-xs font-black text-[#416b36]">第一课专项活动</span><h3 className="mt-4 text-2xl font-black">校园情景口语对话</h3><p className="mt-3 flex-1 leading-7 text-[#687168]">观看并跟读四个校园场景，根据句型提示完成2—3个话轮的自主对话，回听录音并获得系统建议。</p><div className="mt-6 flex items-center justify-between border-t border-[#e4e9e1] pt-5"><span className="font-bold text-[#416b36]">进入 Unit 1 口语任务</span><ChevronRight className="h-6 w-6 transition group-hover:translate-x-1" /></div></div>
              </div>
            </a>

            <div className="grid gap-4 rounded-[30px] border border-dashed border-[#d8cec4] bg-white/65 p-5 sm:p-6">
              <div className="flex items-center gap-3"><Clock3 className="h-6 w-6 text-[#907f70]" /><div><p className="text-xs font-black tracking-[.14em] text-[#8d7d70]">COMING NEXT</p><h3 className="mt-1 text-lg font-black">后续单元</h3></div></div>
              {['Unit 2', 'Unit 3'].map((unit) => <div key={unit} className="flex items-center justify-between rounded-2xl border border-[#e7ded6] bg-white px-4 py-4"><div><strong>{unit}</strong><p className="mt-1 text-sm text-[#7a817a]">学习任务待教师发布</p></div><span className="rounded-full bg-[#f2efec] px-3 py-1 text-xs font-bold text-[#887c71]">未开放</span></div>)}
              <p className="text-sm leading-6 text-[#7b827b]">后续可继续添加听力、阅读、写作或专业英语活动，无需改变学期主线入口。</p>
            </div>
          </div>
        </section>

        <section className="mt-9 rounded-[28px] border border-[#ead0bd] bg-[#fff5ec] p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
          <div className="flex items-start gap-4"><BookOpenCheck className="mt-1 h-7 w-7 shrink-0 text-[#e65a10]" /><div><h3 className="text-lg font-black">本学期使用方法</h3><p className="mt-1 leading-7 text-[#697169]">学情档案可持续更新；每课从学习通打开教师发布的单词链接；其他课堂活动进入对应 Unit 完成。</p></div></div>
          <div className="mt-5 whitespace-nowrap rounded-full bg-white px-5 py-3 text-center text-sm font-black text-[#416b36] shadow-sm sm:mt-0">学期主线 ＋ 当前 Unit</div>
        </section>
        <footer className="py-8 text-center text-sm text-[#7b817a]">Liuzhou Railway Vocational Technical College · July English Lab</footer>
      </div>
    </main>
  );
}
