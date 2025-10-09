# Qualitas Corpus Investigation

## 1. Processing the Entire Qualitas Corpus
Attempting to push the full Qualitas Corpus through the CodeStreamConsumer still ends in a hang once
the in-memory chunk index outgrows the container’s RAM budget. Every processed file retains
`lines`, `chunks`, and `instances`, and the clone index keeps each chunk signature so it can compare
future files. When tens of thousands of Java files have been processed, the Node.js process spends
most of its time swapping and the event loop stalls. The hang is therefore a combined storage and
processing bottleneck: the consumer never frees the raw file payload nor the indexed chunks.

**Mitigations**

- Persist the chunk index (signature → occurrences) and clone metadata in an external key/value
  store such as Redis or RocksDB so the container only caches the hottest entries in memory.
- Stream the preprocessing step so that file contents are released once the chunk signatures have
  been emitted and stored.
- Apply back-pressure to the generator (HTTP 429 responses or a message queue with bounded
  concurrency) to keep the consumer from accepting more work than it can drain.
- Partition the workload by project or package, letting multiple consumer replicas work in parallel
  against a shared signature store.

These changes let the consumer progress through the corpus without hitting a hard RAM ceiling.

## 2. Reducing `CHUNKSIZE` × `CHUNKSIZE` Comparisons
The new `CloneDetector` applies a two-step filter: it normalises source lines, hashes each chunk with
SHA-1, and only performs element-wise comparisons for chunks that share the same hash. This replaces
the quadratic “compare every chunk pair” step with lookups in an inverted index. Additional filters
(such as token fingerprints or Bloom filters) can further reduce the candidate set before the
line-by-line comparison is attempted.

## 3. Timing Trends Over Long Runs
The `/stats` endpoint now tracks processing time, per-line normalised time, and high-percentile
latencies. Runs on large inputs show the usual upward trend: more processed files translate into more
chunk signatures in the index, which makes lookups slower. Clone deduplication also scans a growing
singleton store. The percentiles surface when the caches miss (typically on files from new projects)
and the detector must fetch many historical signatures. Sharding the index or pruning stale chunks
keeps the curve flatter.

## 4. CodeStreamConsumer Deliverable
The fully implemented container, including Dockerfile, Node.js sources, and documentation, is zipped
for submission at `CodeStreamConsumer.zip`. The archive contains the clone detector implementation,
Express app, and the new `/stats` landing page so reviewers can rebuild the consumer locally.
