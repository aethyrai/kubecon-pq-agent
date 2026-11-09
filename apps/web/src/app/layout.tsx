import type { Metadata } from 'next';
import { Atkinson_Hyperlegible_Next } from 'next/font/google';
import { type ReactNode, Suspense } from 'react';
import { SiteNav } from './_components/site-nav';
import { Dash0Rum } from './rum';
import './globals.css';

/** One family for everything. Designed by the Braille Institute for low-vision readers. */
const sans = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: 'KubeCon NA 2026 conference agent',
  description:
    'Which talk, which booth, who to meet. Every request over an Aethyr post-quantum tunnel.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="site">
          <a className="brand" href="/">
            KubeCon NA 2026
            <small>Conference agent</small>
          </a>
          <Suspense
            fallback={
              <nav aria-label="Primary">
                <a href="/">Search</a>
                <a href="/schedule/2026-11-10">Schedule</a>
                <a href="/plan">My plan</a>
                <a href="/booths">Booths</a>
                <a href="/side-events">Side events</a>
              </nav>
            }
          >
            <SiteNav />
          </Suspense>
        </header>
        <main id="main">{children}</main>
        <footer>
          <p>
            Built on November 9, 2026. Aethyr Node is a pre-existing library.{' '}
            <a href="/about">What was built today</a>
            {' · '}
            <a href="/trail">Post-quantum trail</a>
            {' · '}
            <a href="https://github.com/aethyrai/kubecon-pq-agent" rel="noopener">
              Source on GitHub
            </a>
          </p>
        </footer>
        <Dash0Rum />
      </body>
    </html>
  );
}
