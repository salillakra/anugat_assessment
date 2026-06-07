FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Scanned BIT Mesra timetable PDFs require OCR.
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-eng graphicsmagick ghostscript

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Release stage
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Generate Prisma Client
RUN bunx prisma generate

EXPOSE 3001
ENV PORT=3001
ENV NODE_ENV=production

# Default command is to run the API server
CMD ["bun", "run", "src/index.ts"]
