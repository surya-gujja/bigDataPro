import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_LIMIT = 1000;
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), 'data');

export default class Monitor {
  constructor({ limit = DEFAULT_LIMIT, outputDir = process.env.MONITOR_OUTPUT_DIR || DEFAULT_OUTPUT_DIR } = {}) {
    this.limit = limit;
    this.samples = [];
    this.outputDir = outputDir;
    this.outputFile = path.join(this.outputDir, 'metrics_log.jsonl');

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  record(sample) {
    const enriched = { ...sample, recordedAt: new Date().toISOString() };
    this.samples.push(enriched);
    fs.appendFileSync(this.outputFile, `${JSON.stringify(enriched)}\n`);

    if (this.samples.length > this.limit) {
      this.samples.shift();
    }
  }

  latest(count = 50) {
    return this.samples.slice(-count);
  }

  summary() {
    return {
      totalSamples: this.samples.length,
      averages: this.computeAverages(),
      percentiles: this.computePercentiles([50, 90, 95])
    };
  }

  computeAverages() {
    if (!this.samples.length) {
      return {};
    }
    const keys = Object.keys(this.samples[0]).filter((key) => typeof this.samples[0][key] === 'number');
    return keys.reduce((acc, key) => {
      const total = this.samples.reduce((sum, sample) => sum + (sample[key] || 0), 0);
      return { ...acc, [key]: total / this.samples.length };
    }, {});
  }

  computePercentiles(pcts) {
    if (!this.samples.length) {
      return {};
    }
    const numericKeys = Object.keys(this.samples[0]).filter((key) => typeof this.samples[0][key] === 'number');

    return numericKeys.reduce((acc, key) => {
      const sorted = this.samples.map((sample) => sample[key] || 0).sort((a, b) => a - b);
      const keyPercentiles = pcts.reduce((map, pct) => {
        const rank = (pct / 100) * (sorted.length - 1);
        const lower = Math.floor(rank);
        const upper = Math.ceil(rank);
        if (lower === upper) {
          return { ...map, [pct]: sorted[lower] };
        }
        const weight = rank - lower;
        const value = sorted[lower] * (1 - weight) + sorted[upper] * weight;
        return { ...map, [pct]: value };
      }, {});
      return { ...acc, [key]: keyPercentiles };
    }, {});
  }
}
