import { ContextMenuCommandBuilder } from '@discordjs/builders';
import * as db from '../../database.js';
import Translator from '../../translate.js';

export const data = new ContextMenuCommandBuilder()
  .setName('Translate this')
  .setType(3);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const user = await db.getUser(interaction.user.id);
  if (user.discord?.locale) {
    const translation = await Translator.translate(interaction.targetMessage.content, user.discord.locale); // TODO - sanitize
    await interaction.followUp(`${interaction.member.displayName}: ${translation}`);
  } else {await interaction.followUp('You need to set your locale using "/locale" first');}
}