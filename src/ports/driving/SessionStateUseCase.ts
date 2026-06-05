export type SessionAction = "pause" | "resume" | "complete" | "interrupt";

export interface SessionStateInput {
  readonly sessionId: string;
  readonly action: SessionAction;
  readonly correlationId: string;
}

export interface SessionStateOutput {
  readonly sessionId: string;
  readonly status: string;
}

export interface SessionStateUseCase {
  execute(input: SessionStateInput): Promise<SessionStateOutput>;
}
