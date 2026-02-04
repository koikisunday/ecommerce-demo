FROM gitpod/workspace-full:latest

# Ensure docker compose is available (some workspace images include it)
USER root
RUN apt-get update && apt-get install -y docker-compose-plugin || true

# Node is included in the base workspace image; ensure pnpm available optionally
RUN npm i -g npm@latest || true

USER gitpod
