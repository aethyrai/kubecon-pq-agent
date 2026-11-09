import assert from 'node:assert/strict';
import { test } from 'node:test';
import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import { annotate, currentTraceId, traceMixin, withSpan } from './index.js';

const exporter = new InMemorySpanExporter();
const provider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] });
trace.setGlobalTracerProvider(provider);
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());

test('withSpan records attributes, status, nesting, and errors', async () => {
  exporter.reset();
  const out = await withSpan('t', 'outer', { a: 1 }, async () => {
    annotate({ b: 'two' });
    assert.ok(currentTraceId());
    return withSpan('t', 'inner', {}, async () => 42);
  });
  assert.equal(out, 42);
  await assert.rejects(
    () =>
      withSpan('t', 'boom', {}, async () => {
        throw new Error('nope');
      }),
    /nope/,
  );
  const spans = exporter.getFinishedSpans();
  const names = spans.map((x) => x.name).sort();
  assert.deepEqual(names, ['boom', 'inner', 'outer']);
  const outer = spans.find((x) => x.name === 'outer');
  const inner = spans.find((x) => x.name === 'inner');
  const boom = spans.find((x) => x.name === 'boom');
  assert.equal(outer?.attributes.a, 1);
  assert.equal(outer?.attributes.b, 'two');
  assert.equal(inner?.parentSpanContext?.spanId, outer?.spanContext().spanId);
  assert.equal(boom?.status.code, 2);
  assert.equal(boom?.events[0]?.name, 'exception');
});

test('traceMixin stamps trace_id and span_id inside a span and nothing outside', async () => {
  const mixin = traceMixin();
  assert.deepEqual(mixin(), {});
  await withSpan('t', 'logged', {}, async (span) => {
    const fields = mixin();
    assert.equal(fields.trace_id, span.spanContext().traceId);
    assert.equal(fields.span_id, span.spanContext().spanId);
  });
  assert.deepEqual(mixin(), {});
});
