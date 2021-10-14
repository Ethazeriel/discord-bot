#!/bin/bash
source $NVM_DIR/nvm.sh

function deploy() {
echo "Deploying..."
rsync -av --exclude={'package.json','package-lock.json','.nvmrc','/setup/','/node_modules/','/.git/'} ./ ./setup
cd ./setup
nvm use
echo "Where do you want to deploy commands? (guild/global)"
read level
node deploy-commands.js $level
echo "Cleaning up..."
find . ! -name package.json ! -name package-lock.json ! -name .nvmrc ! -regex '^./node_modules\(/.*\)?' -delete
}

[ ! -d "./setup" ] && mkdir setup
if cmp -s ./package.json ./setup/package.json
then
deploy
else
echo "package.json doesn't match. copying parent..."
cp ./package.json ./setup/package.json
cp ./package-lock.json ./setup/package-lock.json
echo "node" > ./setup/.nvmrc
cd ./setup
nvm use
npm install
cd ..
deploy
fi

