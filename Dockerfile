# Node 24 LTS (undici 8, used for the long Gemini request timeouts, needs Node >= 22.19)
FROM node:24-alpine

# Install system dependencies
# ffmpeg: required for video processing
# font-noto*: fonts for burned-in subtitles (without any, libass draws no text):
#   Latin/Cyrillic/Greek, Chinese/Japanese/Korean, Arabic
# python3, make, g++: build tools for native modules (better-sqlite3)
RUN apk add --no-cache ffmpeg font-noto font-noto-cjk font-noto-arabic python3 make g++

WORKDIR /app

# Install dependencies first for caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

# Cleanup build tools to reduce image size (optional, but good practice)
# We keep python3 as some runtime native bindings might rely on it, but usually not needed after build.
# We definitely need ffmpeg at runtime.
RUN npm prune --omit=dev && apk del make g++

# Run as the unprivileged "node" user that ships with the base image
RUN mkdir -p /app/storage && chown -R node:node /app/storage /app/.next
USER node

# Expose the configured port
EXPOSE 3050

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3050

# Start the application
# Binds to 0.0.0.0 to be accessible outside the container
CMD ["npm", "start", "--", "-H", "0.0.0.0"]
