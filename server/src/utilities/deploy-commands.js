/* eslint-disable no-console */
import fs from 'fs';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
const { client_id, guildId, token } = JSON.parse(fs.readFileSync(new URL('../../config.json', import.meta.url))).discord;
const launchArg = process.argv[2];
const commands = [];
const commandFiles = fs.readdirSync(new URL('../interactions/commands', import.meta.url)).filter(file => file.endsWith('.js'));
import * as database from '../database.js';

if (process.argv.length > 3) {
  console.log('Too many arguments');
  process.exit();
} else if (process.argv.length < 3) {
  console.log('Please enter a launch argument. The valid arguments are: guild, global');
  process.exit();
}

console.log('Deployment started with scope: ' + launchArg);
for (const file of commandFiles) {
  const command = await import(`./interactions/commands/${file}`);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    if (launchArg == 'guild') {
      await rest.put(
        Routes.applicationGuildCommands(client_id, guildId),
        { body: commands },
      );
      console.log('Successfully registered commands at scope: guild');
    } else if (launchArg == 'global') {
      await rest.put(
        Routes.applicationCommands(client_id),
        { body: commands },
      );
      console.log('Successfully registered commands at scope: global');
    } else {
      console.log('Invalid launch argument. The valid options are: guild, global');
    }

  } catch (error) {
    console.error(error);
  }
  await database.closeDB();
})();