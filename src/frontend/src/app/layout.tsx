import type { Metadata } from 'next';
import { Be_Vietnam_Pro, JetBrains_Mono, Patrick_Hand } from 'next/font/google';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.css';
import './globals.css';
import { ToastProvider } from '@/components/toast';
import { AuthProvider } from '@/lib/auth';

// All three faces ship the Vietnamese subset so stacked diacritics render correctly.
const ui = Be_Vietnam_Pro({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
  display: 'swap',
});
const code = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  variable: '--font-code',
  display: 'swap',
});
const hand = Patrick_Hand({
  subsets: ['latin', 'vietnamese'],
  weight: '400',
  variable: '--font-handwritten',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Online Judge',
    template: '%s | Online Judge',
  },
  description: 'Hệ thống chấm bài lập trình trực tuyến cho lớp học',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${ui.variable} ${code.variable} ${hand.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
