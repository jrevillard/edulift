#!/bin/sh
set -e

# Generate runtime configuration from environment variables
cat > /usr/share/nginx/html/config.js <<EOF
// Runtime configuration injected by docker-entrypoint.sh
window.__ENV__ = {
  VITE_API_URL: "${VITE_API_URL:-http://localhost:3001/api/v1}",
  VITE_SOCKET_URL: "${VITE_SOCKET_URL:-http://localhost:3001}",
  VITE_SOCKET_FORCE_POLLING: "${VITE_SOCKET_FORCE_POLLING:-false}"
};
EOF

echo "Runtime configuration generated:"
cat /usr/share/nginx/html/config.js

# Start nginx
exec nginx -g "daemon off;"
