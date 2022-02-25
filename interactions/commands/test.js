import { SlashCommandBuilder } from '@discordjs/builders';
import Player from '../../player.js';
import { logLine } from '../../logger.js';

export const data = new SlashCommandBuilder()
  .setName('test')
  .setDescription('test')
  .addStringOption(option =>
    option.setName('command').setDescription('command').setRequired(true));

export async function execute(interaction) {
  if (interaction.member?.roles?.cache?.some(role => role.name === 'DJ')) {
    await interaction.deferReply({ ephemeral: true });

    const command = String(interaction.options.getString('command')).toLowerCase();

    const player = await Player.getPlayer(interaction);
    if (player) {
      switch (command) {
        case 'test': {
          player.test(interaction);
          break;
        }

        case 'reg1': {
          player.reg1(interaction, (async () => player.queueEmbed('Playing Next: ', 1)));
          interaction.followUp(await player.queueEmbed('Playing Next: ', 1));
          break;
        }

        case 'reg2': {
          const action = (async () => player.queueEmbed('Playing Next: ', 1));
          player.reg2(interaction, action);
          interaction.followUp(await player.queueEmbed('Playing Next: ', 1));
          break;
        }

        case 'update': {
          player.update(interaction, 'media');
          break;
        }

        case 'media': {
          const embed = player.mediaEmbed();
          interaction.message = await interaction.followUp(embed);
          await player.register(interaction, 'media', embed);
          break;
        }

        default: {
          logLine('info', ['no test case for this']);
          await interaction.followUp({ content:'No test case for this.', ephemeral: true });
        }
      }
    }
  } else {
    await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });
  }
}