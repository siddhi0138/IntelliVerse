# Grafana for the production deployment — same image and dashboard as the
# local docker-compose one, just pointed at the real deployed Prometheus
# service instead of the local one, since Render's "deploy an existing
# image" path only supports flat Secret Files (no subdirectories), which
# can't reproduce Grafana's datasources/ + dashboards/ provisioning
# structure. Building from the repo instead sidesteps that entirely.
FROM grafana/grafana:13.1.2
COPY provisioning /etc/grafana/provisioning
