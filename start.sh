#!/bin/bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm

cd client
nvm use
npm i
npm run build

cd ../server
nvm use
npm install
npm run build
cd ..
node server/build/index