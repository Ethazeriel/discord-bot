const fs = require('fs');
// Require the necessary discord.js classes
const { Client, Collection, Intents } = require('discord.js');
const { token } = require('./config.json').discord;
const { logLine, logCommand, logComponent, logDebug } = require('./logger.js');
const { leaveVoice } = require('./music');
const database = require('./database.js');
const chalk = require('chalk');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES] });

// pull commands from individual files
client.commands = new Collection();
const commandFiles = fs.readdirSync('./interactions/commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./interactions/commands/${file}`);
  // Set a new item in the Collection
  // With the key as the command name and the value as the exported module
  client.commands.set(command.data.name, command);
}

const buttons = new Collection();
const buttonFiles = fs.readdirSync('./interactions/buttons').filter(file => file.endsWith('.js'));
for (const file of buttonFiles) {
  const button = require(`./interactions/buttons/${file}`);
  // Set a new item in the Collection
  // With the key as the command name and the value as the exported module
  buttons.set(button.name, button);
}

const selects = new Collection();
const selectFiles = fs.readdirSync('./interactions/selects').filter(file => file.endsWith('.js'));
for (const file of selectFiles) {
  const select = require(`./interactions/selects/${file}`);
  // Set a new item in the Collection
  // With the key as the command name and the value as the exported module
  selects.set(select.name, select);
}

// When the client is ready, run this code (only once)
client.once('ready', () => {
  logDebug(chalk.red.bold('DEBUG MODE ACTIVE'));
  logLine('info', ['Ready!', `Node version: ${process.version}`]);
  database.printCount();
});

// actually run the commands
client.on('interactionCreate', async interaction => {
  // console.log(interaction);
  // if (!interaction.isCommand() || !interaction.isSelectMenu()) return;
  if (interaction.isCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      logCommand(interaction);
      await command.execute(interaction);
    } catch (error) {
      logLine('error', [error.stack]);
      return interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
    }
  } else if (interaction.isSelectMenu()) {
    logComponent(interaction);
    const selectMenu = selects.get(interaction.customId);
    try {
      await selectMenu.execute(interaction);
    } catch (error) {
      logLine('error', [error.stack]);
      return interaction.update({ content: 'There was an error while processing this select menu!', components: [], ephemeral: true });
    }
  } else if (interaction.isButton()) {
    logComponent(interaction);
    const match = interaction.customId.match(/([A-z]*)[-]([A-z]*)/);
    const buttonPress = buttons.get(match[1]);
    try {
      await buttonPress.execute(interaction, match[2]);
    } catch (error) {
      logLine('error', [error.stack]);
      return interaction.update({ content: 'There was an error while processing this button press!', components: [], ephemeral: true });
    }
  } else {return;}
});


// Login to Discord
client.login(token);

process.on('SIGINT' || 'SIGTERM', async () => {
  logLine('info', ['received termination command, exiting']);
  leaveVoice();
  await database.closeDB();
  process.exit();
});