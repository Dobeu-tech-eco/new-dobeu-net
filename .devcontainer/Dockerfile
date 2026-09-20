FROM mcr.microsoft.com/devcontainers/javascript-node:5.1-24-bookworm

USER root

RUN npm install --global vercel@59.23.2 \
    && npx --yes playwright@1.60.0 install-deps chromium \
    && npm cache clean --force \
    && rm -rf /root/.npm

USER node
