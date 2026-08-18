# Custom Vercel Function container image (OCI).
# Target registry:
#   vcr.vercel.com/dobeutechnology/new-dobeu-net/new-dobeu-net-oci
#
# Requirements (https://vercel.com/docs/functions/container-images):
# - HTTP server listens on $PORT (default 80)
# - Handle SIGTERM for graceful scale-in
# - Build for linux/amd64 (and optionally arm64)

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
# Vercel container functions default to port 80 when PORT is unset.
ENV PORT=80

COPY path.mjs server.mjs ./

EXPOSE 80

USER node

CMD ["node", "server.mjs"]
