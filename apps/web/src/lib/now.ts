import type { NextMoveResponse } from './api';

const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/** The ?now= override, when it has the form the api accepts. */
export function validNow(v: string | string[] | undefined): string | undefined {
  return typeof v === 'string' && LOCAL_TIME.test(v) ? v : undefined;
}

export interface Formatters {
  time: (local: string) => string;
  room: (room: string) => string;
  day: (day: string) => string;
}
export interface Headline {
  title: string;
  detail: string;
}

const minutes = (n: number): string => `${n} minute${n === 1 ? '' : 's'}`;

/** One title and one sentence group that answer "where should I be?". */
export function headline(m: NextMoveResponse, f: Formatters): Headline {
  const { current, next } = m;
  switch (m.state) {
    case 'no_plan':
      return {
        title: 'Your plan has no talks',
        detail: 'Add talks to your plan, and this page will tell you where to go.',
      };
    case 'done':
      return {
        title: 'Your plan is finished',
        detail: 'No talks in your plan are still to come.',
      };
    case 'go_now': {
      if (!next) break;
      const walk =
        next.walk_estimate_minutes === null
          ? ''
          : ` The walk is about ${minutes(next.walk_estimate_minutes)} (estimate).`;
      const behind =
        next.leave_in_minutes !== null && next.leave_in_minutes < 0
          ? ` You are ${minutes(-next.leave_in_minutes)} behind.`
          : '';
      return {
        title: `Go now to ${f.room(next.session.room)}`,
        detail: `“${next.session.title}” starts at ${f.time(next.session.start)}.${walk}${behind}`,
      };
    }
    case 'in_session': {
      if (!current) break;
      return {
        title: `You should be in ${f.room(current.session.room)}`,
        detail: `“${current.session.title}” ends at ${f.time(current.session.end)}.`,
      };
    }
    case 'free': {
      if (!next) break;
      const where = `“${next.session.title}” in ${f.room(next.session.room)}`;
      const at = f.time(next.session.start);
      if (m.free_minutes === null) {
        return {
          title: 'Nothing more today',
          detail: `Next is ${where}, ${f.day(next.session.day)} at ${at}.`,
        };
      }
      const leave = next.leave_by ? ` Leave by ${f.time(next.leave_by)} (estimate).` : '';
      return {
        title: `You are free for ${minutes(m.free_minutes)}`,
        detail: `Next is ${where} at ${at}.${leave}`,
      };
    }
    default: {
      const unreachable: never = m.state;
      throw new Error(`unknown state ${String(unreachable)}`);
    }
  }
  throw new Error(`state ${m.state} arrived without its session`);
}
