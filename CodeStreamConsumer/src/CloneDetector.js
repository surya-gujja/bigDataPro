import crypto from 'node:crypto';
import SourceLine from './SourceLine.js';
import Clone from './Clone.js';
import CloneStorage from './CloneStorage.js';
import FileStorage from './FileStorage.js';

const DEFAULT_CHUNK_SIZE = 5;

export default class CloneDetector {
  // Instrumented clone detector with monitoring hooks for the Qualitas analysis.
  constructor({ chunkSize = DEFAULT_CHUNK_SIZE, monitor = null } = {}) {
    this.chunkSize = chunkSize;
    this.chunkIndex = new Map();
    this.monitor = monitor;
  }

  attachMonitor(monitor) {
    this.monitor = monitor;
  }

  process(file) {
    const metrics = {
      fileName: file.name,
      rawBytes: file.contents.length
    };

    const filterStart = process.hrtime.bigint();
    const lines = this.filterLines(file.contents);
    const filterEnd = process.hrtime.bigint();

    const chunkStart = process.hrtime.bigint();
    const chunks = this.chunkify(file.name, lines);
    const chunkEnd = process.hrtime.bigint();

    const { instances, stats } = this.identifyClones(file.name, chunks);

    file.lines = lines;
    file.chunks = chunks;
    file.instances = instances;

    FileStorage.getInstance().addFile({
      name: file.name,
      chunks,
      linesCount: lines.length
    });

    metrics.lineCount = lines.length;
    metrics.chunkCount = chunks.length;
    metrics.cloneCount = instances.length;
    metrics.candidateCount = stats.totalCandidates;
    metrics.expandedClones = stats.expandedClones;
    metrics.avgCloneSize = stats.avgCloneSize;
    metrics.filterMs = Number(filterEnd - filterStart) / 1_000_000;
    metrics.chunkifyMs = Number(chunkEnd - chunkStart) / 1_000_000;
    metrics.candidateLookupMs = stats.candidateLookupMs;
    metrics.candidateExpansionMs = stats.candidateExpansionMs;

    if (this.monitor) {
      this.monitor.record(metrics);
    }

    file.metrics = metrics;

    return file;
  }

  filterLines(contents) {
    const rawLines = contents.split(/\r?\n/);
    const filtered = [];
    let insideBlockComment = false;

    rawLines.forEach((text, index) => {
      const trimmed = text.trim();

      if (insideBlockComment) {
        if (/\*\//.test(trimmed)) {
          insideBlockComment = false;
        }
        return;
      }

      if (!trimmed.length) {
        return;
      }

      if (/^\s*\/\//.test(trimmed)) {
        return;
      }

      if (/^\s*\/\*/.test(trimmed)) {
        if (!/\*\//.test(trimmed)) {
          insideBlockComment = true;
        }
        return;
      }

      filtered.push(new SourceLine(index + 1, text));
    });

    return filtered;
  }

  chunkify(fileName, lines) {
    const chunks = [];
    for (let i = 0; i <= lines.length - this.chunkSize; i += 1) {
      const slice = lines.slice(i, i + this.chunkSize);
      const signature = this.hashChunk(slice);
      chunks.push({
        file: fileName,
        signature,
        lines: slice,
        range: { start: slice[0].number, end: slice[slice.length - 1].number }
      });
    }
    return chunks;
  }

  identifyClones(fileName, chunks) {
    const cloneStorage = CloneStorage.getInstance();
    const instances = [];
    const stats = {
      totalCandidates: 0,
      expandedClones: 0,
      candidateLookupNs: 0n,
      candidateExpansionNs: 0n,
      totalCloneSize: 0
    };

    for (const chunk of chunks) {
      const lookupStart = process.hrtime.bigint();
      const matches = this.chunkIndex.get(chunk.signature) || [];
      stats.candidateLookupNs += process.hrtime.bigint() - lookupStart;
      stats.totalCandidates += matches.length;

      const expansionStart = process.hrtime.bigint();
      for (const match of matches) {
        if (match.file === fileName && match.range.start === chunk.range.start) {
          continue;
        }
        const clone = new Clone(
          chunk.signature,
          match.file,
          match.range,
          fileName,
          chunk.range
        );
        cloneStorage.addClone(clone);
        instances.push(clone);
        stats.expandedClones += 1;
        stats.totalCloneSize += clone.size();
      }
      stats.candidateExpansionNs += process.hrtime.bigint() - expansionStart;

      matches.push({
        file: fileName,
        range: chunk.range
      });
      this.chunkIndex.set(chunk.signature, matches);
    }

    const toMs = (value) => Number(value) / 1_000_000;
    const avgCloneSize = stats.expandedClones
      ? stats.totalCloneSize / stats.expandedClones
      : 0;

    return {
      instances,
      stats: {
        totalCandidates: stats.totalCandidates,
        expandedClones: stats.expandedClones,
        avgCloneSize,
        candidateLookupMs: toMs(stats.candidateLookupNs),
        candidateExpansionMs: toMs(stats.candidateExpansionNs)
      }
    };
  }

  hashChunk(lines) {
    const hash = crypto.createHash('sha1');
    const normalised = lines.map((line) => line.normalised()).join('\n');
    hash.update(normalised);
    return hash.digest('hex');
  }
}
