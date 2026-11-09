import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Dash0Rum } from './rum';
import './globals.css';

export const metadata: Metadata = {
  title: 'KubeCon NA 2026 conference agent',
  description:
    'Which talk, which booth, who to meet. Every request over an Aethyr post-quantum tunnel.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header>
          <nav aria-label="Primary">
            <a href="/">Search</a> <a href="/schedule/2026-11-10">Schedule</a>{' '}
            <a href="/plan">My plan</a> <a href="/booths">Booths</a>{' '}
            <a href="/side-events">Side events</a> <a href="/?mode=full">Full</a>{' '}
            <a href="/?mode=text">Text mode</a> <a href="/?mode=reader">Screen reader mode</a>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer>
          <p>Built on November 9, 2026. Aethyr Node is a pre-existing library.</p>
        </footer>
        <Dash0Rum />
      </body>
    </html>
  );
}
