import express from 'express';
import multer from 'multer';
import Timer from './Timer.js';
import CloneDetector from './CloneDetector.js';
import CloneStorage from './CloneStorage.js';
import FileStorage from './FileStorage.js';

const upload = multer({ storage: multer.memoryStorage() });
const app = express();
const detector = new CloneDetector();
const timings = [];
let lastResult = null;

function formatDuration(value) {
  return `${value.toFixed(2)} ms`;
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values, p) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = rank - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

app.get('/', (_req, res) => {
  if (!lastResult) {
    res.send('<h1>CodeStreamConsumer</h1><p>No files processed yet.</p>');
    return;
  }

  const cloneCount = lastResult.clones.length;
  res.send(`
    <h1>Last processed file</h1>
    <ul>
      <li><strong>Name:</strong> ${lastResult.name}</li>
      <li><strong>Processing time:</strong> ${formatDuration(lastResult.duration)}</li>
      <li><strong>Source lines:</strong> ${lastResult.lines}</li>
      <li><strong>Clones found:</strong> ${cloneCount}</li>
    </ul>
    <p>See <a href="/stats">/stats</a> for historical timing data.</p>
  `);
});

app.get('/stats', (_req, res) => {
  if (!timings.length) {
    res.send('<h1>Timing statistics</h1><p>No files processed yet.</p>');
    return;
  }

  const durations = timings.map((entry) => entry.duration);
  const perLine = timings.map((entry) => entry.duration / Math.max(entry.lines, 1));
  const filesProcessed = timings.length;

  const cloneStorageSize = CloneStorage.getInstance().all().length;
  const processedFiles = FileStorage.getInstance().all().length;

  const rows = timings
    .slice(-50)
    .reverse()
    .map(
      (entry) => `
        <tr>
          <td>${entry.timestamp}</td>
          <td>${entry.name}</td>
          <td>${formatDuration(entry.duration)}</td>
          <td>${entry.lines}</td>
          <td>${(entry.duration / Math.max(entry.lines, 1)).toFixed(4)} ms/line</td>
        </tr>`
    )
    .join('');

  res.send(`
    <h1>Timing statistics</h1>
    <p><strong>Total files processed:</strong> ${filesProcessed}</p>
    <p><strong>Total clones stored:</strong> ${cloneStorageSize}</p>
    <ul>
      <li>Average duration: ${formatDuration(average(durations))}</li>
      <li>P95 duration: ${formatDuration(percentile(durations, 95))}</li>
      <li>Average per-line duration: ${(average(perLine)).toFixed(4)} ms/line</li>
      <li>P95 per-line duration: ${(percentile(perLine, 95)).toFixed(4)} ms/line</li>
    </ul>
    <table border="1" cellspacing="0" cellpadding="4">
      <thead>
        <tr>
          <th>Timestamp</th>
          <th>File</th>
          <th>Duration</th>
          <th>Lines</th>
          <th>Normalised</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `);
});

app.post('/upload', upload.single('code'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No code file provided.' });
    return;
  }

  const timer = new Timer('processFile');
  timer.start();

  const payload = {
    name: req.file.originalname,
    contents: req.file.buffer.toString('utf8')
  };

  const processed = detector.process(payload);
  const duration = timer.stop();

  const result = {
    name: processed.name,
    duration,
    lines: processed.lines.length,
    clones: processed.instances
  };

  lastResult = { ...result };
  timings.push({
    name: result.name,
    duration: result.duration,
    lines: result.lines,
    timestamp: new Date().toISOString()
  });

  res.json({
    message: 'File processed successfully',
    duration,
    clones: result.clones,
    lines: result.lines
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`CodeStreamConsumer listening on port ${port}`);
});
