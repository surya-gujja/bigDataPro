# Qualitas Corpus Stream Processing Assets

This repository contains the instrumented cljDetector (CodeStreamConsumer), monitoring utilities,
and the LaTeX report requested for the Qualitas Corpus investigation.

## Contents
- `CodeStreamConsumer/` — instrumented consumer with monitoring endpoints.
- `MonitorTool/` — CLI for analysing exported metrics.
- `data/metrics_sample.csv` — first 100 rows of collected timing data.
- `qualitas_report.tex` — detailed answers and analysis in LaTeX form.
- `stream-of-code.yaml` — docker-compose specification binding generator and consumer.

For a full discussion of methodology, performance trends, and mitigation strategies, see
[`qualitas_report.tex`](qualitas_report.tex).

> **Note:** Submission zip archives are intentionally excluded from version control. Recreate them
> using the packaging scripts documented in `CodeStreamConsumer/README.md` and
> `MonitorTool/README.md` when preparing deliverables.
