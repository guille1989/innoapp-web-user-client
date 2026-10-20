/** Invalida respuestas antiguas y cancela lecturas de una sesión desmontada. */
export class RequestScope {
  private active = true;
  private tasks = new Map<string, AbortController>();

  activate() {
    this.active = true;
  }

  cancel(key: string) {
    this.tasks.get(key)?.abort();
    this.tasks.delete(key);
  }

  start(key: string) {
    this.cancel(key);
    const controller = new AbortController();
    if (!this.active) controller.abort();
    else this.tasks.set(key, controller);
    return {
      signal: controller.signal,
      isCurrent: () => this.active && !controller.signal.aborted && this.tasks.get(key) === controller,
      finish: () => {
        if (this.tasks.get(key) === controller) this.tasks.delete(key);
      },
    };
  }

  dispose() {
    this.active = false;
    for (const controller of this.tasks.values()) controller.abort();
    this.tasks.clear();
  }
}
