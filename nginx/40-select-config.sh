#!/bin/sh
# Picks nginx's configuration from DOMAIN (run by the nginx image's entrypoint before nginx starts).
# Without a domain the site is served over plain HTTP. With one, HTTPS is served once certbot has
# its certificate: until then nginx serves HTTP (which answers certbot's challenge), because it
# refuses to start with a missing certificate. A background loop then switches to HTTPS when the
# first certificate appears and reloads nginx whenever certbot renews it.
set -eu

templates=/etc/nginx/colcom
conf=/etc/nginx/nginx.conf
DOMAIN=${DOMAIN:-}

log() {
  echo "$0: $*"
}

if [ -z "$DOMAIN" ]; then
  log "DOMAIN is not set, serving plain HTTP"
  cp "$templates/nginx-http.conf" "$conf"
  exit 0
fi

# It goes into the configuration and into a path, so only a hostname is accepted
if ! printf '%s' "$DOMAIN" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$'; then
  log "DOMAIN must be a hostname like colcom.example, not \"$DOMAIN\""
  exit 1
fi

cert=/etc/letsencrypt/live/$DOMAIN/fullchain.pem

cert_mtime() {
  stat -L -c %Y "$cert" 2>/dev/null || true
}

# Renders the HTTPS configuration and keeps the previous one if nginx rejects it
use_https() {
  sed "s/\${DOMAIN}/$DOMAIN/g" "$templates/nginx-https.conf" > "$conf.new"
  if nginx -t -q -c "$conf.new"; then
    mv "$conf.new" "$conf"
  else
    rm -f "$conf.new"
    log "the HTTPS configuration for $DOMAIN failed nginx -t, keeping the previous one"
    return 1
  fi
}

served=
if [ -n "$(cert_mtime)" ] && use_https; then
  log "serving HTTPS for $DOMAIN"
  served=$(cert_mtime)
else
  log "no certificate for $DOMAIN yet, serving HTTP until certbot gets one"
  cp "$templates/nginx-http.conf" "$conf"
fi

# Runs alongside nginx; a minute's delay is enough both for the first certificate and for renewals
(
  while :; do
    sleep 60
    current=$(cert_mtime)
    if [ -n "$current" ] && [ "$current" != "$served" ] && use_https; then
      served=$current
      log "certificate for $DOMAIN changed, reloading nginx"
      nginx -s reload || true
    fi
  done
) < /dev/null &
