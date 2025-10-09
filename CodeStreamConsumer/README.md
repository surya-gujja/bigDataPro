# CodeStreamConsumer

This container hosts an Express.js service that receives code files via HTTP POST requests,
processes them through a rolling-hash based clone detector, and exposes timing statistics through
simple dashboards.

## Available Endpoints

- `POST /upload` – accepts multipart/form-data with the field `code`. Each file is processed in
  sequence and evaluated for clones against previously submitted files.
- `GET /` – returns summary information for the most recently processed file.
- `GET /stats` – returns aggregate timing data, including historical processing durations and
  normalised timings per source line.

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

Run the container:

```bash
docker run -p 8080:3000 csconsumer
```

Mounting the source tree as a bind mount enables live development while the container is running.
