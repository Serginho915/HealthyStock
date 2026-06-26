FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS dev
WORKDIR /app
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

FROM base AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/data ./data
EXPOSE 4000
CMD ["npm", "run", "start"]
