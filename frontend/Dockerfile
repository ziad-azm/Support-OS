# Dev-parity image for the optional Compose stack — PROD-4 (Story 93).
# Runs the Vite DEV server; this image builds no production bundle.
FROM node:20-slim

WORKDIR /app

# `npm ci` from the committed lockfile, and only after copying the manifests,
# so a source edit does not invalidate the dependency layer. This install MUST
# happen inside the image: several devDependencies (oxlint, esbuild) resolve a
# platform-specific binary, so a host-built node_modules is the wrong platform.
# docker-compose.yml masks the bind mount at /app/node_modules to keep this one.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# `--host 0.0.0.0` is required: vite.config.ts sets no `server.host`, so Vite
# binds to localhost and a published port would refuse every connection.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
