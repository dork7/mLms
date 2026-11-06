# Debian, not Alpine: the Chromium that renders PDFs (src/web/pdf.ts) doesn't run on musl.
FROM node:24-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Chromium with its system libraries and fonts, at the version package-lock.json pins. A fixed
# path, so the browser is found whichever user or HOME the app runs with.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install --with-deps --only-shell chromium

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
# Migrations and the first-Admin seed run on every start; both are idempotent.
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm run start -- --port 3000"]
