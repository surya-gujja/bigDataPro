#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

if (process.argv.length < 3) {
  console.error('Usage: node analyser.js <metrics.csv>');
  process.exit(1);
}

const filePath = path.resolve(process.argv[2]);
const content = fs.readFileSync(filePath, 'utf8').trim().split('\n');
const [header, ...rows] = content;
const columns = header.split(',');

const data = rows.map((row) => {
  const values = row.split(',');
  return columns.reduce((acc, col, index) => {
    const value = values[index];
    return { ...acc, [col]: Number.isFinite(Number(value)) ? Number(value) : value };
  }, {});
});

function average(key) {
  return data.reduce((sum, entry) => sum + Number(entry[key] || 0), 0) / data.length;
}

function slope(xKey, yKey) {
  const xs = data.map((entry) => Number(entry[xKey] || 0));
  const ys = data.map((entry) => Number(entry[yKey] || 0));
  const meanX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  const numerator = xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index] - meanY), 0);
  const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  return numerator / denominator;
}

const summary = {
  averageLines: average('line_count'),
  averageChunks: average('chunk_count'),
  averageCandidates: average('candidate_count'),
  averageClones: average('clone_count'),
  averageCloneSize: average('avg_clone_size'),
  meanChunkifyMs: average('chunkify_ms'),
  meanCandidateLookupMs: average('candidate_lookup_ms'),
  meanExpansionMs: average('candidate_expansion_ms'),
  chunkifySlope: slope('chunk_count', 'chunkify_ms'),
  candidateLookupSlope: slope('candidate_count', 'candidate_lookup_ms'),
  expansionSlope: slope('clone_count', 'candidate_expansion_ms')
};

console.table(summary);
