/**
 * INTERACTIVE_PERSISTENT_SUBJECT_RUNTIME_V0 — strictly ordered serial queue.
 *
 * Guarantees the V0 interaction law: input N fully completes before input N+1
 * begins. Every enqueued task runs exactly once, in submission order, and never
 * concurrently with another task.
 */

export class SerialTaskQueueV0 {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;

  enqueue(task: () => Promise<void>): void {
    this.pending += 1;
    this.tail = this.tail.then(task).catch(() => undefined).finally(() => {
      this.pending -= 1;
    });
  }

  /** Resolves once every task submitted so far has settled. */
  async drain(): Promise<void> {
    await this.tail;
  }

  pendingCount(): number {
    return this.pending;
  }
}
