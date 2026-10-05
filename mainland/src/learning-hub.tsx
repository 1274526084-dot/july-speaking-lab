import { BookOpenCheck, Headphones, UserRound, BarChart3 } from 'lucide-react';
import { sitePath } from './api';
import { CourseBoard } from './course-board';

export function LearningHub() {
  return (
    <main className="min-h-screen bg-[#f6f7f1] px-4 py-6 text-[#2d4234] sm:px-7">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-xs font-bold tracking-widest text-[#8a957e]">
              RAILWAY ENGLISH
            </p>
            <h1 className="mt-1 text-2xl font-bold">英语学习站</h1>
          </div>
          <a
            className="flex items-center gap-2 rounded-xl border border-[#d4ddcb] bg-white px-4 py-2 text-sm font-bold"
            href={sitePath('workbench')}
          >
            <BarChart3 size={17} />
            教师入口
          </a>
        </header>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { title: '我的档案', href: sitePath('archive'), icon: UserRound },
            {
              title: '学情调查',
              href: sitePath('profile'),
              icon: BookOpenCheck,
            },
            { title: '单词跟读', href: sitePath('words'), icon: Headphones },
          ].map(({ title, href, icon: Icon }) => (
            <a
              key={title}
              href={href}
              className="flex flex-col items-center gap-2 rounded-2xl border border-[#dde5d5] bg-white p-4 text-sm font-bold sm:flex-row sm:justify-center"
            >
              <Icon size={20} className="text-[#738b55]" />
              {title}
            </a>
          ))}
        </div>
        <CourseBoard />
        <footer className="py-4 text-center text-xs text-[#87917d]">
          柳州铁道职业技术学院 · 英语成长档案
        </footer>
      </div>
    </main>
  );
}
