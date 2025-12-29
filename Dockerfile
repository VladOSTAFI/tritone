FROM node:20-alpine

# Install LibreOffice and dependencies
RUN apk add --no-cache \
    libreoffice \
    openjdk11-jre \
    font-liberation \
    ttf-dejavu \
    fontconfig

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build Next.js app
RUN pnpm run build

# Create data directory
RUN mkdir -p /app/data/active

EXPOSE 3000

CMD ["pnpm", "start"]
