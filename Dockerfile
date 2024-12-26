# syntax=docker/dockerfile:1
# build the react client package
FROM node:22-alpine AS clientbuild
ENV NODE_ENV=production
WORKDIR /client
COPY client/package* ./
COPY client/vite.config.ts ./
RUN npm install
COPY client/public ./public
COPY client/src ./src
COPY client/index.html ./
COPY @types ./src/@types
COPY client/tsconfig.json ./tsconfig.json
COPY client/.eslintrc.json ./.eslintrc.json
RUN npm run build

# separately build server code so we don't have to package typescript/etc in the final container
FROM node:22-alpine AS serverbuild
RUN apk --no-cache add python3
WORKDIR /server
COPY server/package* ./
RUN npm install
COPY server/src ./src
COPY @types ./src/@types
COPY server/tsconfig.json ./tsconfig.json
COPY server/eslint.config.mjs ./.eslint.config.mjs
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
# youtube-dl-exec needs python
RUN apk --no-cache add python3
RUN apk --no-cache add dumb-init
WORKDIR /goose
COPY --chown=node:node server/package.json server/package-lock.json ./
RUN npm install
COPY --chown=node:node  --from=serverbuild /server/build ./build
WORKDIR /client-assets
COPY --chown=node:node --from=clientbuild /client/build .
WORKDIR /nginx
COPY --chown=node:node nginx.conf ./goose.conf.template
WORKDIR /goose
CMD ["dumb-init", "node", "build/index"]
EXPOSE 2468