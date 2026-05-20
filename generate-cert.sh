#!/bin/sh
# generate-cert.sh — генерирует self-signed TLS сертификат для localhost
# Запускать ОДИН РАЗ перед docker compose up
# Требует: openssl

set -e
CERT_DIR="$(dirname "$0")/certs"
mkdir -p "$CERT_DIR"

if [ -f "$CERT_DIR/localhost.crt" ]; then
  echo "Сертификат уже существует: $CERT_DIR/localhost.crt"
  echo "Удалите папку certs/ и запустите скрипт снова чтобы перегенерировать."
  exit 0
fi

openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout "$CERT_DIR/localhost.key" \
  -out    "$CERT_DIR/localhost.crt" \
  -subj   "/C=RU/ST=Local/L=Local/O=Marshrut/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo ""
echo "✓ Сертификат создан:"
echo "  $CERT_DIR/localhost.crt"
echo "  $CERT_DIR/localhost.key"
echo ""
echo "Чтобы браузер доверял сертификату и камера работала:"
echo ""
echo "  macOS:   sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/localhost.crt"
echo "  Linux:   sudo cp certs/localhost.crt /usr/local/share/ca-certificates/marshrut.crt && sudo update-ca-certificates"
echo "  Windows: двойной клик на certs/localhost.crt → Установить → Локальный компьютер → Доверенные корневые УЦ"
echo ""
echo "После этого запустите: docker compose up -d --build"
echo "Откройте: https://localhost:8443"
