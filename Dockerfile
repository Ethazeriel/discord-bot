# syntax=docker/dockerfile:1
# build the react client package
FROM node:20-alpine as clientbuild
ENV NODE_ENV production
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
FROM node:18-alpine3.17 as serverbuild
RUN apk --no-cache add python3
WORKDIR /server
COPY server/package* ./
RUN npm install
COPY server/src ./src
COPY @types ./src/@types
COPY server/tsconfig.json ./tsconfig.json
COPY server/.eslintrc.json ./.eslintrc.json
RUN npm run build

# temporary- pin alpine to version 3.17 to allow use of prebuilt opus packages
# once we've set up a build env that can make these, we can use that - or maybe the available binaries will update someday
FROM node:18-alpine3.17
ENV NODE_ENV production
RUN apk add dumb-init
# youtube-dl-exec needs python
RUN apk --no-cache add python3
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