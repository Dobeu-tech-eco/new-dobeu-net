FROM mcr.microsoft.com/devcontainers/javascript-node:5.1-24-bookworm

RUN npx --yes playwright@1.60.0 install-deps chromium \
    && apt-get update \
    && apt-get install -y --no-install-recommends ripgrep shellcheck \
    && npm install --global vercel@59.23.2 \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/* /root/.npm
