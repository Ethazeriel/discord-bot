import fs from 'fs';
import { REST } from 'discord.js';
import { Routes } from 'discord-api-types/v9';
import { log } from './logger.js';
import { fileURLToPath, URL } from 'url';
const { client_id, guildId, token, scope } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../config.json', import.meta.url).toString()), 'utf-8')).discord;
const commands:object[] = [];
const commandFiles = fs.readdirSync(fileURLToPath(new URL('./interactions/commands', import.meta.url).toString()), 'utf-8').filter(file => file.endsWith('.js'));
const contextFiles = fs.readdirSync(fileURLToPath(new URL('./interactions/contexts', import.meta.url).toString()), 'utf-8').filter(file => file.endsWith('.js'));

export async function deploy() {
  log('command', [`Deploying commands to ${scope} scope`]);
  for (const file of commandFiles) {
    const command = await import(`./interactions/commands/${file}`);
    commands.push(command.data.toJSON());
  }
  for (const file of contextFiles) {
    const command = await import(`./interactions/contexts/${file}`);
    commands.push(command.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(token);
  try {
    if (scope === 'guild') {
      await rest.put(
        Routes.applicationGuildCommands(client_id, guildId),
        { body: commands },
      );
      log('command', ['Successfully registered commands.']);
    } else if (scope === 'global') {
      await rest.put(
        Routes.applicationCommands(client_id),
        { body: commands },
      );
      log('command', ['Successfully registered commands.']);
    } else {
      log('command', ['Failed to deploy commands']);
    }

  } catch (error) {
    console.error(error);
  }

}