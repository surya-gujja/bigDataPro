# CodeStreamConsumer

This container hosts an Express.js service that receives code files via HTTP POST requests, processes
them through an instrumented rolling-hash based clone detector, and exposes timing statistics through
HTML dashboards and JSON endpoints.

## Available Endpoints

- `POST /upload` – accepts multipart/form-data with the field `code`. Each file is processed in
  sequence and evaluated for clones against previously submitted files.
- `GET /` – returns summary information for the most recently processed file.
- `GET /stats` – returns aggregate timing data, including historical processing durations, per-stage
  metrics (chunkify, candidate lookup, expansion), and averages/percentiles.
- `GET /stats/raw` – dumps the latest samples and summaries as JSON for offline analysis.

## Development

Install dependencies with `npm install`, then run `npm run dev` to start the development server with
auto-reload.

The service expects files to be submitted by the CodeStreamGenerator container. For manual testing,
you can run:

```bash
curl -F "code=@path/to/File.java" http://localhost:3000/upload
```

## Docker

Build the image:

```bash
docker build -t csconsumer .
```

Run the container with bind mounts for live code edits and metric export:

```bash
docker run -p 8080:3000 \
  -v $(pwd):/app \
  -v $(pwd)/data:/app/data \
  -e MONITOR_OUTPUT_DIR=/app/data \
  csconsumer
```

To assemble the submission archive that is omitted from version control, run:

```bash
npm run package
```

The resulting `CodeStreamConsumer.zip` appears in the project root.

Mounting the source tree as a bind mount enables live development while the container is running.
