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
    const instances = this.identifyClones(file.name, lines, chunks);

    file.lines = lines;
    file.chunks = chunks;
    file.instances = instances;

    FileStorage.getInstance().addFile({
      name: file.name,
      chunks,
      lines,
      linesCount: lines.length
    });

    return file;
  }

  filterLines(contents) {
    const rawLines = contents.split(/\r?\n/);
    const filtered = [];
    let insideBlockComment = false;

    rawLines.forEach((text, index) => {
      let builder = '';
      let inSingleQuote = false;
      let inDoubleQuote = false;
      let inTemplateString = false;
      let escaped = false;

      for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];

        if (insideBlockComment) {
          if (char === '*' && next === '/') {
            insideBlockComment = false;
            i += 1;
          }
          continue;
        }

        if (!inSingleQuote && !inDoubleQuote && !inTemplateString) {
          if (char === '/' && next === '*') {
            insideBlockComment = true;
            i += 1;
            continue;
          }
          if (char === '/' && next === '/') {
            break;
          }
        }

        builder += char;

        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (!inDoubleQuote && !inTemplateString && char === '\'') {
          inSingleQuote = !inSingleQuote;
        } else if (!inSingleQuote && !inTemplateString && char === '"') {
          inDoubleQuote = !inDoubleQuote;
        } else if (!inSingleQuote && !inDoubleQuote && char === '`') {
          inTemplateString = !inTemplateString;
        }
      }

      const cleaned = builder.replace(/\s+$/u, '');
      if (!insideBlockComment && cleaned.trim().length) {
        filtered.push(new SourceLine(index + 1, cleaned));
      }
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
        range: { start: slice[0].number, end: slice[slice.length - 1].number },
        index: i
      });
    }
    return chunks;
  }

  identifyClones(fileName, lines, chunks) {
    const cloneStorage = CloneStorage.getInstance();
    const fileStorage = FileStorage.getInstance();
    const candidates = new Map();

    for (const chunk of chunks) {
      const matches = this.chunkIndex.get(chunk.signature) || [];
      for (const match of matches) {
        if (match.file === fileName && match.index === chunk.index) {
          continue;
        }

        const matchFile = match.file === fileName ? lines : fileStorage.get(match.file)?.lines;
        if (!matchFile) {
          continue;
        }

        const candidate = this.expandClone(
          match.file,
          matchFile,
          match.index,
          fileName,
          lines,
          chunk.index
        );

        if (!candidate) {
          continue;
        }

        const key = `${candidate.signature}:${candidate.fileA}:${candidate.rangeA.start}-${candidate.rangeA.end}:${candidate.fileB}:${candidate.rangeB.start}-${candidate.rangeB.end}`;
        if (!candidates.has(key)) {
          candidates.set(key, candidate);
        }
      }

      matches.push({
        file: fileName,
        range: chunk.range,
        index: chunk.index
      });
      this.chunkIndex.set(chunk.signature, matches);
    }

    const consolidated = this.consolidateClones(Array.from(candidates.values()));

    for (const clone of consolidated) {
      cloneStorage.addClone(clone);
    }

    return consolidated;
  }

  expandClone(fileAName, fileALines, indexA, fileBName, fileBLines, indexB) {
    const baseLength = this.chunkSize;

    if (
      indexA + baseLength > fileALines.length ||
      indexB + baseLength > fileBLines.length
    ) {
      return null;
    }

    for (let offset = 0; offset < baseLength; offset += 1) {
      const lineA = fileALines[indexA + offset];
      const lineB = fileBLines[indexB + offset];
      if (!lineA || !lineB || !lineA.equals(lineB)) {
        return null;
      }
    }

    let startA = indexA;
    let startB = indexB;
    let length = baseLength;

    while (
      startA > 0 &&
      startB > 0 &&
      fileALines[startA - 1] &&
      fileBLines[startB - 1] &&
      fileALines[startA - 1].equals(fileBLines[startB - 1])
    ) {
      startA -= 1;
      startB -= 1;
      length += 1;
    }

    while (
      startA + length < fileALines.length &&
      startB + length < fileBLines.length &&
      fileALines[startA + length] &&
      fileBLines[startB + length] &&
      fileALines[startA + length].equals(fileBLines[startB + length])
    ) {
      length += 1;
    }

    const sliceA = fileALines.slice(startA, startA + length);
    const sliceB = fileBLines.slice(startB, startB + length);

    if (!sliceA.length || !sliceB.length) {
      return null;
    }

    const signature = this.hashChunk(sliceA);

    return new Clone(
      signature,
      fileAName,
      { start: sliceA[0].number, end: sliceA[sliceA.length - 1].number },
      fileBName,
      { start: sliceB[0].number, end: sliceB[sliceB.length - 1].number }
    );
  }

  consolidateClones(clones) {
    if (!clones.length) {
      return clones;
    }

    const groups = new Map();

    for (const clone of clones) {
      const key = `${clone.fileA}::${clone.fileB}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(clone);
    }

    const result = [];

    for (const group of groups.values()) {
      const ordered = group
        .slice()
        .sort((a, b) => {
          if (a.rangeA.start === b.rangeA.start) {
            const lenA = a.rangeA.end - a.rangeA.start;
            const lenB = b.rangeA.end - b.rangeA.start;
            return lenB - lenA;
          }
          return a.rangeA.start - b.rangeA.start;
        });

      const consolidated = [];

      for (const candidate of ordered) {
        let subsumed = false;

        for (let i = consolidated.length - 1; i >= 0; i -= 1) {
          const existing = consolidated[i];

          if (this.isSubClone(existing, candidate)) {
            subsumed = true;
            break;
          }

          if (this.isSubClone(candidate, existing)) {
            consolidated.splice(i, 1);
          }
        }

        if (!subsumed) {
          consolidated.push(candidate);
        }
      }

      result.push(...consolidated);
    }

    return result;
  }

  isSubClone(container, contained) {
    return (
      container.fileA === contained.fileA &&
      container.fileB === contained.fileB &&
      container.rangeA.start <= contained.rangeA.start &&
      container.rangeA.end >= contained.rangeA.end &&
      container.rangeB.start <= contained.rangeB.start &&
      container.rangeB.end >= contained.rangeB.end
    );
  }

  hashChunk(lines) {
    const hash = crypto.createHash('sha1');
    const normalised = lines.map((line) => line.normalised()).join('\n');
    hash.update(normalised);
    return hash.digest('hex');
  }
}
