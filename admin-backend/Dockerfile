FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
COPY .env.example ./.env.example
EXPOSE 5010
CMD ["npm", "start"]
