FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
# Migrations and the first-Admin seed run on every start; both are idempotent.
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm run start -- --port 3000"]
