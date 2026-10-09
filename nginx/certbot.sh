#!/bin/sh
# Gets the certificate for DOMAIN from Let's Encrypt and keeps renewing it (the certbot service's
# entrypoint). nginx answers the challenge from the shared webroot and reloads on its own when the
# certificate changes (40-select-config.sh). Without a domain there is nothing to do.
set -eu

DOMAIN=${DOMAIN:-}
webroot=/var/www/certbot

if [ -z "$DOMAIN" ]; then
  echo "DOMAIN is not set, serving plain HTTP: no certificate needed"
  exit 0
fi
# Let's Encrypt no longer sends expiry warnings, so the email is optional (account recovery and
# policy changes only)
email="--email ${LETSENCRYPT_EMAIL:-}"
if [ -z "${LETSENCRYPT_EMAIL:-}" ]; then
  email=--register-unsafely-without-email
fi

staging=
if [ -n "${LETSENCRYPT_STAGING:-}" ]; then
  staging=--staging
fi

# --cert-name keeps the files under live/$DOMAIN/, where nginx looks for them
if [ ! -e "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  # Gives nginx time to start serving the challenge
  sleep 10
  # Let's Encrypt allows only 5 failed validations per hour, so failures (DNS not pointing here
  # yet, port 80 closed) are retried slowly
  until certbot certonly --webroot -w "$webroot" --cert-name "$DOMAIN" -d "$DOMAIN" \
    $email --agree-tos --no-eff-email --non-interactive $staging; do
    echo "Could not get a certificate for $DOMAIN, trying again in an hour"
    sleep 3600
  done
fi

# Renews only certificates within 30 days of expiring, so running it twice a day is cheap
while :; do
  certbot renew --webroot -w "$webroot" --non-interactive || true
  sleep 43200
done
