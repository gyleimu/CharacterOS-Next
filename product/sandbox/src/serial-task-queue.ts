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

  /**
   * CHARACTEROS_VISUAL_PRODUCT_LOCAL_WEB_V0 — serialized execution that RETURNS
   * the task's result (the fire-and-forget `enqueue` cannot). Same law: task N
   * fully settles before task N+1 starts; a rejection never breaks the chain.
   */
  run<T>(task: () => Promise<T>): Promise<T> {
    this.pending += 1;
    const result = this.tail.then(task);
    this.tail = result.then(
      () => undefined,
      () => undefined
    );
    void this.tail.finally(() => {
      this.pending -= 1;
    });
    return result;
  }

  /** Resolves once every task submitted so far has settled. */
  async drain(): Promise<void> {
    await this.tail;
  }

  pendingCount(): number {
    return this.pending;
  }
}
