import { SlashCommandBuilder } from '@discordjs/builders';
import Player from '../../player.js';
import { log } from '../../logger.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CommandInteraction, GuildMemberRoleManager, Message, WebhookEditMessageOptions } from 'discord.js';
import { APIMessage } from 'discord-api-types';
const { discord } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../config.json', import.meta.url).toString()), 'utf-8'));
const roles = discord.roles;

export const data = new SlashCommandBuilder()
  .setName('voice')
  .setDescription('voice related functions')
  .addSubcommand(subcommand => subcommand
    .setName('nowplaying')
    .setDescription('Gets the current track'))
  .addSubcommand(subcommand => subcommand
    .setName('join')
    .setDescription('joins you in voice'))
  .addSubcommand(subcommand => subcommand
    .setName('leave')
    .setDescription('forces the bot to leave voice'));

interface MusicInteraction extends CommandInteraction {
  message: APIMessage | Message<boolean>
}
export async function execute(interaction:MusicInteraction):Promise<void> {

  if ((interaction.member?.roles as GuildMemberRoleManager)?.cache?.some(role => role.name === roles.dj)) {
    await interaction.deferReply({ ephemeral: true });
    const command = interaction.options.getSubcommand();
    if (command == 'leave') {
      await interaction.editReply(Player.leave(interaction));
    } else {
      const player = await Player.getPlayer(interaction, { explicitJoin: (command == 'join') });
      if (player && command != 'join') {
        switch (command) {
          case 'nowplaying': {
            if (player.getQueue().length) {
              const embed = await player.mediaEmbed();
              interaction.message = await interaction.editReply(embed) as Message<boolean>;
              await player.register(interaction, 'media', embed);
            } else { await player.decommission(interaction, 'media', await player.mediaEmbed(false), 'Queue is empty.'); }
            break;
          }

          default: {
            log('error', ['OH NO SOMETHING\'S FUCKED']);
            await interaction.editReply({ content: 'Something broke. Please try again', ephemeral: true } as WebhookEditMessageOptions);
          }
        }
      }
    }
  } else { await interaction.reply({ content: 'You don\'t have permission to do that.', ephemeral: true });}
}