import { SlashCommandBuilder } from '@discordjs/builders';
import { Player } from '../../player.js';
import { log } from '../../logger.js';
import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import { ChatInputCommandInteraction, GuildMemberRoleManager, Message, InteractionReplyOptions } from 'discord.js';
const { discord } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../../config.json', import.meta.url).toString()), 'utf-8'));
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

interface MusicInteraction extends ChatInputCommandInteraction {
  message: Message<boolean>
}
export async function execute(interaction:MusicInteraction):Promise<void> {

  if ((interaction.member?.roles as GuildMemberRoleManager)?.cache?.some(role => role.name === roles.dj)) {
    await interaction.deferReply({ ephemeral: true });
    const command = interaction.options.getSubcommand();
    if (command == 'leave') {
      await interaction.editReply(await Player.leave(interaction));
    } else {
      const { player, message } = await Player.getPlayer(interaction);
      if (player) {
        switch (command) {
          case 'join': {
            interaction.editReply({ content: 'Joined voice.' });
            break;
          }
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
            await interaction.editReply({ content: 'Something broke. Please try again', ephemeral: true } as InteractionReplyOptions);
          }
        }
      } else { interaction.editReply({ content: message }); }
    }
  } else { await interaction.reply({ content: 'You don\'t have permission to do that.', ephemeral: true });}
}