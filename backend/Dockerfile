FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY uploads/.gitkeep ./uploads/.gitkeep

EXPOSE 3000

CMD ["npm", "run", "start"]