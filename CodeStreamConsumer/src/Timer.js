export default class Timer {
  constructor(label) {
    this.label = label;
    this.startedAt = null;
    this.stoppedAt = null;
  }

  start() {
    this.startedAt = process.hrtime.bigint();
    this.stoppedAt = null;
  }

  stop() {
    if (!this.startedAt) {
      throw new Error(`Timer ${this.label} has not been started`);
    }
    this.stoppedAt = process.hrtime.bigint();
    return this.durationMs();
  }

  durationMs() {
    if (!this.startedAt) {
      return 0;
    }
    const end = this.stoppedAt ?? process.hrtime.bigint();
    return Number(end - this.startedAt) / 1_000_000;
  }
}
