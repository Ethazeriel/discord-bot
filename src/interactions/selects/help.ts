import { SelectMenuInteraction } from 'discord.js';
import { helpEmbed } from '../commands/help.js';

export const name = 'help';

export async function execute(interaction:SelectMenuInteraction) { // dropdown selection function
  const choice = interaction.values[0];
  const result = helpEmbed(choice);
  await interaction.update(result);
}