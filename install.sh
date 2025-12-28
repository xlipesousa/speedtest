#!/bin/bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Este instalador precisa ser executado como root." >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REQUIREMENTS_FILE="$SCRIPT_DIR/requirements.txt"
DEPLOY_DIR=${DEPLOY_DIR:-/var/www/html}
WEB_USER=${WEB_USER:-www-data}
WEB_GROUP=${WEB_GROUP:-www-data}
IPERF_ENV_FILE=/etc/default/iperf3
IPERF_SERVICE_FILE=/etc/systemd/system/iperf3.service
IPERF_WRAPPER=/usr/local/bin/iperf3-systemd.sh
IPERF_LOG_FILE=${IPERF3_LOG_FILE:-/var/log/iperf3.log}
LOGROTATE_FILE=/etc/logrotate.d/iperf3

if [[ ! -f "$REQUIREMENTS_FILE" ]]; then
  echo "Arquivo requirements.txt não encontrado em $SCRIPT_DIR" >&2
  exit 1
fi

APT_PACKAGES=()
while IFS='' read -r raw || [[ -n "$raw" ]]; do
  line=${raw%%#*}
  line=${line%%$'\r'}
  line=${line##*( )}
  line=${line%%*( )}
  if [[ -z "$line" ]]; then
    continue
  fi
  case "$line" in
    apt:*)
      pkg=${line#apt:}
      pkg=${pkg// /}
      if [[ -n "$pkg" ]]; then
        APT_PACKAGES+=("$pkg")
      fi
      ;;
    *)
      echo "Aviso: entrada desconhecida em requirements.txt: $line" >&2
      ;;
  esac
done < "$REQUIREMENTS_FILE"

if [[ ${#APT_PACKAGES[@]} -gt 0 ]]; then
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y "${APT_PACKAGES[@]}"
fi

run_as_invoker() {
  if [[ -n ${SUDO_USER:-} && $SUDO_USER != "root" ]]; then
    sudo -u "$SUDO_USER" "$@"
  else
    "$@"
  fi
}

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
systemctl enable --now iperf3.service

if systemctl list-units --type=service | grep -q apache2.service; then
  systemctl reload apache2.service || systemctl restart apache2.service
fi

echo "Instalação concluída. Aplicação disponível em $DEPLOY_DIR"
