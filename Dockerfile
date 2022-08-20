# syntax=docker/dockerfile:1
FROM node:16-alpine as clientbuild
WORKDIR /react
COPY react/package* ./
RUN npm install
COPY react/public ./public
COPY react/src ./src
COPY react/tsconfig.json ./tsconfig.json
RUN npm run build

FROM node:16-alpine
RUN apk --no-cache add python3
RUN ln -s /usr/bin/python3 /usr/bin/python
RUN apk --no-cache add --virtual canvas-deps make g++ cairo-dev pango-dev
WORKDIR /goose
COPY package.json package-lock.json ./
RUN npm install
RUN npm install -g typescript
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN tsc
RUN rm -r src tsconfig.json
COPY --from=clientbuild /react/build ./react/build

CMD ["node", "build/index"]
EXPOSE 2468