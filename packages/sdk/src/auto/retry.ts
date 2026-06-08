import { createHash } from "crypto";

export interface RetrySignature {
  url: string;
  model?: string;
  bodyHash: string;
}

export interface RetryState {
  signature: RetrySignature;
  stepId: string;
  attempt: number;
}

let lastRetryState: RetryState | null = null;

function hashBody(body: unknown): string {
  const text =
    body == null
      ? ""
      : typeof body === "string"
        ? body
        : JSON.stringify(body);
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function resolveRetryAttempt(
  url: string,
  model: string | undefined,
  body: unknown
): { attempt: number; parentStepId?: string } {
  const signature: RetrySignature = {
    url,
    model,
    bodyHash: hashBody(body),
  };

  if (
    lastRetryState &&
    lastRetryState.signature.url === signature.url &&
    lastRetryState.signature.model === signature.model &&
    lastRetryState.signature.bodyHash === signature.bodyHash
  ) {
    lastRetryState = {
      ...lastRetryState,
      attempt: lastRetryState.attempt + 1,
    };
    return {
      attempt: lastRetryState.attempt,
      parentStepId: lastRetryState.stepId,
    };
  }

  return { attempt: 1 };
}

export function registerRetryStep(stepId: string, url: string, model?: string, body?: unknown): void {
  lastRetryState = {
    signature: { url, model, bodyHash: hashBody(body) },
    stepId,
    attempt: lastRetryState?.stepId === stepId ? (lastRetryState.attempt) : 1,
  };
}

export function resetRetryStateForTests(): void {
  lastRetryState = null;
}
