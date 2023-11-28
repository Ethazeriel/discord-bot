# syntax=docker/dockerfile:1
FROM node:18-alpine as clientbuild
ENV NODE_ENV production
WORKDIR /client
COPY client/package* ./
RUN npm install
COPY client/public ./public
COPY client/src ./src
COPY @types ./src/@types
COPY client/tsconfig.json ./tsconfig.json
COPY client/.eslintrc.json ./.eslintrc.json
RUN npm run build

# temporary- pin alpine to version 3.17 to allow use of prebuilt opus packages
# once we've set up a build env that can make these, we can use that - or maybe the available binaries will update someday
FROM node:18-alpine3.17
ENV NODE_ENV production
RUN apk add dumb-init
RUN apk --no-cache add python3
# RUN ln -s /usr/bin/python3 /usr/bin/python
WORKDIR /goose
COPY --chown=node:node server/package.json server/package-lock.json ./
RUN npm install
COPY --chown=node:node server/tsconfig.json ./tsconfig.json
COPY --chown=node:node server/src ./src
COPY --chown=node:node @types ./src/@types
RUN npm run build
RUN rm -r src tsconfig.json
WORKDIR /client-assets
COPY --chown=node:node --from=clientbuild /client/build .
WORKDIR /nginx
COPY --chown=node:node nginx.conf ./goose.conf.template
WORKDIR /goose
CMD ["dumb-init", "node", "build/index"]
EXPOSE 2468