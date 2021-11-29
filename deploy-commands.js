const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token } = require('./config.json').discord;
const launchArg = process.argv[2];
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const database = require('./database.js');

if (process.argv.length > 3) {
  console.log('Too many arguments');
  process.exit();
} else if (process.argv.length < 3) {
  console.log('Please enter a launch argument. The valid arguments are: guild, global');
  process.exit();
}

console.log('Deployment started with scope: ' + launchArg);
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    if (launchArg == 'guild') {
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      console.log('Successfully registered commands at scope: guild');
    } else if (launchArg == 'global') {
      await rest.put(
        Routes.applicationCommands(clientId),
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