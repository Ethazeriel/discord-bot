# syntax=docker/dockerfile:1
FROM node:16-alpine as clientbuild
ENV NODE_ENV production
WORKDIR /client
COPY client/package* ./
RUN npm install
COPY client/public ./public
COPY client/src ./src
COPY @types ./src/@types
COPY client/tsconfig.json ./tsconfig.json
RUN npm run build

FROM node:16-alpine
ENV NODE_ENV production
RUN apk add dumb-init
RUN apk --no-cache add python3
RUN ln -s /usr/bin/python3 /usr/bin/python
WORKDIR /goose
COPY --chown=node:node server/package.json server/package-lock.json ./
RUN npm install
RUN npm install -g typescript
COPY --chown=node:node server/tsconfig.json ./tsconfig.json
COPY --chown=node:node server/src ./src
COPY --chown=node:node @types ./src/@types
RUN tsc
RUN rm -r src tsconfig.json
WORKDIR /client-assets
COPY --chown=node:node --from=clientbuild /client/build .
WORKDIR /nginx
COPY --chown=node:node nginx.conf ./goose.conf.template
WORKDIR /goose
CMD ["dumb-init", "node", "build/index"]
EXPOSE 2468