const fs = require('fs');
// Require the necessary discord.js classes
global.AbortController = require('abort-controller');
const { Client, Collection, Intents } = require('discord.js');
const { token } = require('./config.json').discord;
const { logLine } = require('./logger.js');
const { leaveVoice } = require('./music');
const database = require('./database.js');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES] });

// pull commands from individual files
client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  // Set a new item in the Collection
  // With the key as the command name and the value as the exported module
  client.commands.set(command.data.name, command);
}

// When the client is ready, run this code (only once)
client.once('ready', () => {
  logLine('info', ['Ready!', `Node version: ${process.version}`]);
  database.printCount();
});

// actually run the commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    logLine('error', [error.stack]);
    return interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
  }
});

// Login to Discord
client.login(token);

process.on('SIGINT' || 'SIGTERM', async () => {
  logLine('info', ['received termination command, exiting']);
  leaveVoice();
  await database.closeDB();
  process.exit();
});