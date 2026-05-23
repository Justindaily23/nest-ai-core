# 1. Base image (Upgraded to current Active LTS)
FROM node:24-alpine

# 2. Create app directory 
WORKDIR /usr/src/app

# 3. Copy dependency definitions first (cache optimization)
COPY package*.json ./

# 4. Install dependencies
RUN npm install

# 5. Copy source code
COPY . .

# 6. Expose port
EXPOSE 3000

# 7. Start the application with hot-reloading
CMD ["npm", "run", "start:dev"]
