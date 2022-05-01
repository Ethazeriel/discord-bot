import fs from 'fs';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { logLine } from './logger.js';
const { client_id, guildId, token, scope } = JSON.parse(fs.readFileSync(new URL('./config.json', import.meta.url))).discord;
const commands = [];
const commandFiles = fs.readdirSync(new URL('./interactions/commands', import.meta.url)).filter(file => file.endsWith('.js'));
const contextFiles = fs.readdirSync(new URL('./interactions/contexts', import.meta.url)).filter(file => file.endsWith('.js'));

export async function deploy() {
  logLine('command', [`Deploying commands to ${scope} scope`]);
  for (const file of commandFiles) {
    const command = await import(`./interactions/commands/${file}`);
    commands.push(command.data.toJSON());
  }
  for (const file of contextFiles) {
    const command = await import(`./interactions/contexts/${file}`);
    commands.push(command.data.toJSON());
  }

  const rest = new REST({ version: '9' }).setToken(token);
  try {
    if (scope === 'guild') {
      await rest.put(
        Routes.applicationGuildCommands(client_id, guildId),
        { body: commands },
      );
      logLine('command', ['Successfully registered commands.']);
    } else if (scope === 'global') {
      await rest.put(
        Routes.applicationCommands(client_id),
        { body: commands },
      );
      logLine('command', ['Successfully registered commands.']);
    } else {
      logLine('command', ['Failed to deploy commands']);
    }

  } catch (error) {
    console.error(error);
  }

}