FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY uploads/.gitkeep ./uploads/.gitkeep

RUN mkdir -p /app/uploads && chown -R node:node /app

EXPOSE 3000

USER node

CMD ["npm", "run", "start"]
