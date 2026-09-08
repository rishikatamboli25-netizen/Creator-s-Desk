# 1. Base image: Lightweight Node 18
FROM node:22-alpine

# 2. Set the working directory inside the container
WORKDIR /usr/src/app

# 3. Copy package files first to leverage Docker layer caching
COPY package*.json ./

# 4. Install production dependencies only
RUN npm install --omit=dev

# 5. Copy the rest of the microservice source code
COPY . .

# 6. Expose the port (Compose will handle the actual mapping)
EXPOSE 5005

# 7. Start the service
CMD ["node", "index.js"]