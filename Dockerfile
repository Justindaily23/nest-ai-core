# Base image
FROM node:24-alpine

# Create app directory 
WORKDIR /usr/src/app

# Install dependencies
RUN npm install -g pnpm

# Copy dependency definitions first (cache optimization)
COPY package*.json pnpm-lock.yaml* ./

# Install all dependencies (including devDependencies like @nestjs/cli)
# Inject pnpm_config_ environment variables to bypass the 1-day safety cooldown 
RUN pnpm_config_minimum_release_age=0 pnpm install --dangerously-allow-all-builds

# Copy source code
COPY . .

RUN pnpm run build

# Expose port
EXPOSE 3000

# Start the application with hot-reloading
CMD ["pnpm", "run", "start:dev"]
