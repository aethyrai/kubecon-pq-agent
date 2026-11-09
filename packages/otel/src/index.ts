import { type Attributes, type Span, SpanStatusCode, trace } from '@opentelemetry/api';

/**
 * Run `fn` inside a named span. Attributes are set up front, errors are recorded and re-thrown,
 * and the span always ends. Keeps business code free of tracer plumbing.
 */
export async function withSpan<T>(
  tracerName: string,
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer(tracerName);
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const out = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return out;
    } catch (err) {
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}

/** Add attributes to the current span, if any. */
export function annotate(attributes: Attributes): void {
  trace.getActiveSpan()?.setAttributes(attributes);
}

/** The current trace id, for log correlation. */
export function currentTraceId(): string | undefined {
  return trace.getActiveSpan()?.spanContext().traceId;
}

/**
 * pino `mixin` that stamps trace_id and span_id on every log line written inside a span, so
 * Dash0 links the line to its trace. No instrumentation package needed; works with any pino.
 */
export function traceMixin(): () => Record<string, string> {
  return () => {
    const ctx = trace.getActiveSpan()?.spanContext();
    return ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {};
  };
}
