# One image: builds the React client, then serves it and the API from one Express process.
# NOTE: written without being able to run Docker; if the build fails, send the error.

FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Client
COPY client/package*.json client/
RUN cd client && if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY client client
RUN cd client && npm run build

# Server (the Prisma schema must be present before install: postinstall runs "prisma generate")
COPY server/package*.json server/
COPY server/prisma server/prisma
RUN cd server && if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY server server

FROM node:22-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/server server
COPY --from=build /app/client/dist client/dist
WORKDIR /app/server
USER node
EXPOSE 4000
# Applies database migrations, then starts the server.
CMD ["npm", "run", "start:prod"]
