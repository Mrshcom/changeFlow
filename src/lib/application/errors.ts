import type { ProblemCode } from "@/lib/http/problem-details";

export class ApplicationError extends Error {
  constructor(readonly status: number, readonly code: ProblemCode, message: string) {
    super(message);
    this.name = "ApplicationError";
  }
}
