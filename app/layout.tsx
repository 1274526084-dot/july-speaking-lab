import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'July英语情景对话练习',
  description: '四个校园场景的听说支架、语音识别与自主对话练习。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
