# Base image
FROM node:24-alpine

# Create app directory 
WORKDIR /usr/src/app

# Copy dependency definitions first (cache optimization)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start the application with hot-reloading
CMD ["npm", "run", "start:dev"]
