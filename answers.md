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
The revamped `CloneDetector` removes comments and normalises whitespace before chunking, then hashes
each chunk with SHA-1 so only equal hashes ever trigger a detailed comparison. When a hit is found
the detector expands it to the longest possible sequence by walking backwards and forwards through
the cached `SourceLine` arrays and consolidates the resulting clones so that shorter duplicates are
discarded. Even long clones therefore require a single hash lookup and one expansion pass rather
than repeated chunk-to-chunk comparisons. Additional filters (such as token fingerprints or Bloom
filters) can further cut down the number of candidates that reach this step.

## 3. Timing Trends Over Long Runs
The `/stats` endpoint now captures per-file timing history (capped to the latest 5,000 samples),
shows the last 50 observations in a table, and reports aggregate metrics such as median, P95, and
per-line distributions plus overall throughput. On large runs the average and percentile timings
creep upward as more signatures accumulate in the in-memory index, increasing the number of matches
each upload must walk through. Clone deduplication also spends longer merging overlaps because the
expansion step traverses increasingly long arrays. Sharding the index or periodically pruning stale
entries keeps the curves flatter.

## 4. CodeStreamConsumer Deliverable
The fully implemented container, including Dockerfile, Node.js sources, and documentation, is zipped
for submission at `CodeStreamConsumer.zip`. The archive contains the clone detector implementation,
Express app, and the new `/stats` landing page so reviewers can rebuild the consumer locally.
