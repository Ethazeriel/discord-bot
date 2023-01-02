#!/bin/bash

cd client
nvm use
npm i
npm run build
cd ../server
nvm use
npm i
tsc
cd ..
node server/build/index