# Lightweight Node.js 22 Alpine image
FROM node:22-alpine

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package files first for Docker layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy the Invoice Service source code
COPY . .

# Invoice Service port
EXPOSE 5006

# Start the service
CMD ["node", "index.js"]

