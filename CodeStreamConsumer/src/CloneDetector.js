import crypto from 'node:crypto';
import SourceLine from './SourceLine.js';
import Clone from './Clone.js';
import CloneStorage from './CloneStorage.js';
import FileStorage from './FileStorage.js';

const DEFAULT_CHUNK_SIZE = 5;

export default class CloneDetector {
  constructor({ chunkSize = DEFAULT_CHUNK_SIZE } = {}) {
    this.chunkSize = chunkSize;
    this.chunkIndex = new Map();
  }

  process(file) {
    const lines = this.filterLines(file.contents);
    const chunks = this.chunkify(file.name, lines);
    const instances = this.identifyClones(file.name, chunks);

    file.lines = lines;
    file.chunks = chunks;
    file.instances = instances;

    FileStorage.getInstance().addFile({
      name: file.name,
      chunks,
      linesCount: lines.length
    });

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

    for (const chunk of chunks) {
      const matches = this.chunkIndex.get(chunk.signature) || [];
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
      }

      matches.push({
        file: fileName,
        range: chunk.range
      });
      this.chunkIndex.set(chunk.signature, matches);
    }

    return instances;
  }

  hashChunk(lines) {
    const hash = crypto.createHash('sha1');
    const normalised = lines.map((line) => line.normalised()).join('\n');
    hash.update(normalised);
    return hash.digest('hex');
  }
}
