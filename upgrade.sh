#!/bin/bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Este atualizador precisa ser executado como root." >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
DEPLOY_DIR=${DEPLOY_DIR:-/var/www/html}
WEB_USER=${WEB_USER:-www-data}
WEB_GROUP=${WEB_GROUP:-www-data}
IPERF_ENV_FILE=/etc/default/iperf3
IPERF_SERVICE_FILE=/etc/systemd/system/iperf3.service
IPERF_WRAPPER=/usr/local/bin/iperf3-systemd.sh
IPERF_LOG_FILE=${IPERF3_LOG_FILE:-/var/log/iperf3.log}
LOGROTATE_FILE=/etc/logrotate.d/iperf3

run_as_invoker() {
  if [[ -n ${SUDO_USER:-} && $SUDO_USER != "root" ]]; then
    sudo -u "$SUDO_USER" "$@"
  else
    "$@"
  fi
}

run_as_invoker bash -lc "cd '$SCRIPT_DIR' && git fetch --all"
run_as_invoker bash -lc "cd '$SCRIPT_DIR' && git pull --ff-only"

if [[ -f "$SCRIPT_DIR/package.json" ]]; then
  run_as_invoker bash -lc "cd '$SCRIPT_DIR' && npm install"
  run_as_invoker bash -lc "cd '$SCRIPT_DIR' && npm run build:legacy"
fi

mkdir -p "$DEPLOY_DIR"
rsync -a \
  --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'projeto-original/' \
  --exclude 'data/' \
  "$SCRIPT_DIR/" "$DEPLOY_DIR/"

mkdir -p "$DEPLOY_DIR/data"
chown "$WEB_USER":"$WEB_GROUP" "$DEPLOY_DIR/data"
chmod 775 "$DEPLOY_DIR/data"

cat > "$IPERF_WRAPPER" <<'EOF'
#!/bin/bash
set -euo pipefail
HOST_IP=${IPERF3_BIND_ADDRESS:-$(hostname -I | awk '{print $1}')}
if [[ -z "${HOST_IP}" ]]; then
  echo "Falha ao determinar IP local" >&2
  exit 1
fi
LOG_FILE=${IPERF3_LOG_FILE:-/var/log/iperf3.log}
exec /usr/bin/iperf3 -s -B "${HOST_IP}" --logfile "${LOG_FILE}"
EOF
chmod +x "$IPERF_WRAPPER"

if [[ ! -f "$IPERF_ENV_FILE" ]]; then
  cat > "$IPERF_ENV_FILE" <<'EOF'
# Variáveis opcionais para o serviço iperf3
# IPERF3_BIND_ADDRESS=192.0.2.10
# IPERF3_LOG_FILE=/var/log/iperf3.log
EOF
fi

cat > "$IPERF_SERVICE_FILE" <<EOF
[Unit]
Description=Servidor iperf3 persistente
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=-$IPERF_ENV_FILE
ExecStart=$IPERF_WRAPPER
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

mkdir -p "$(dirname "$IPERF_LOG_FILE")"
touch "$IPERF_LOG_FILE"
chmod 644 "$IPERF_LOG_FILE"
chown root:root "$IPERF_LOG_FILE"

cat > "$LOGROTATE_FILE" <<EOF
$IPERF_LOG_FILE {
    daily
    rotate 7
    compress
    missingok
    notifempty
    create 0644 root root
}
EOF

systemctl daemon-reload
systemctl restart iperf3.service

if systemctl list-units --type=service | grep -q apache2.service; then
  systemctl reload apache2.service || systemctl restart apache2.service
fi

echo "Atualização concluída. Aplicação sincronizada em $DEPLOY_DIR"
