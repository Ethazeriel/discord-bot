import { SlashCommandBuilder } from '@discordjs/builders';
import Player from '../../player.js';
import { logLine } from '../../logger.js';

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


export async function execute(interaction) {

  if (interaction.member?.roles?.cache?.some(role => role.name === 'DJ')) {
    await interaction.deferReply({ ephemeral: true });

    const command = interaction.options.getSubcommand();
    if (command == 'leave') {
      await interaction.followUp(Player.leave(interaction));
    } else {
      const player = await Player.getPlayer(interaction, { explicitJoin: (command == 'join') });
      if (player && command != 'join') {
        switch (command) {
          case 'nowplaying': {
            if (player.getQueue().length) {
              const embed = player.mediaEmbed();
              interaction.message = await interaction.followUp(embed);
              await player.register(interaction, 'media', embed);
            } else { await interaction.followUp({ content: 'Queue is empty.' }); }
            break;
          }

          default: {
            logLine('error', ['OH NO SOMETHING\'S FUCKED']);
            await interaction.followUp({ content: 'Something broke. Please try again', ephemeral: true });
          }
        }
      }
    }
  } else { await interaction.reply({ content: 'You don\'t have permission to do that.', ephemeral: true });}
}