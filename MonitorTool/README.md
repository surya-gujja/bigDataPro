# MonitorTool

This lightweight CLI inspects the metrics produced by the instrumented cljDetector. It expects a CSV
file with the schema described in `data/metrics_sample.csv` and prints summary statistics matching the
LaTeX report.

```
node analyser.js ../data/metrics_sample.csv
```
