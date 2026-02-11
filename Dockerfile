FROM node:20-alpine

# Install system dependencies
# ffmpeg: required for video processing
# python3, make, g++: build tools for native modules (better-sqlite3)
RUN apk add --no-cache ffmpeg python3 make g++

WORKDIR /app

# Install dependencies first for caching
COPY package.json package-lock.json ./
RUN npm install

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

# Cleanup build tools to reduce image size (optional, but good practice)
# We keep python3 as some runtime native bindings might rely on it, but usually not needed after build.
# We definitely need ffmpeg at runtime.
RUN apk del make g++

# Expose the configured port
EXPOSE 3050

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3050

# Start the application
# Binds to 0.0.0.0 to be accessible outside the container
CMD ["npm", "start", "--", "-p", "3050", "-H", "0.0.0.0"]
