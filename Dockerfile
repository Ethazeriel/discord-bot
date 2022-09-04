# syntax=docker/dockerfile:1
FROM node:16-alpine as clientbuild
ENV NODE_ENV production
WORKDIR /react
COPY react/package* ./
RUN npm install
COPY react/public ./public
COPY react/src ./src
COPY react/tsconfig.json ./tsconfig.json
RUN npm run build

FROM node:16-alpine
ENV NODE_ENV production
RUN apk add dumb-init
RUN apk --no-cache add python3
RUN ln -s /usr/bin/python3 /usr/bin/python
RUN apk --no-cache add --virtual canvas-deps make g++ cairo-dev pango-dev
WORKDIR /goose
COPY --chown=node:node package.json package-lock.json ./
RUN npm install
RUN npm install -g typescript
COPY --chown=node:node tsconfig.json ./tsconfig.json
COPY --chown=node:node src ./src
RUN tsc
RUN rm -r src tsconfig.json
WORKDIR /client-assets
COPY --chown=node:node --from=clientbuild /react/build .
WORKDIR /nginx
COPY --chown=node:node nginx.conf ./goose.conf.template
WORKDIR /goose
CMD ["dumb-init", "node", "build/index"]
EXPOSE 2468