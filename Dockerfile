# syntax=docker/dockerfile:1
FROM node:16-alpine
RUN apk --no-cache add python3
RUN ln -s /usr/bin/python3 /usr/bin/python
RUN apk --no-cache add --virtual canvas-deps make g++ cairo-dev pango-dev
WORKDIR /goose
COPY . .
RUN npm install
RUN npm install -g typescript
RUN tsc
WORKDIR /goose/react
RUN npm install
RUN npm run build
WORKDIR /goose
RUN apk del canvas-deps
CMD ["node", "build/index"]
EXPOSE 2468