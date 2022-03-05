import { SlashCommandBuilder } from '@discordjs/builders';
import Translator from '../../translate.js';
import * as db from '../../database.js';
import { sanitize } from '../../regexes.js';

export const data = new SlashCommandBuilder()
  .setName('locale')
  .setDescription('Set your locale for bot functions and translation')
  .addStringOption(option =>
    option.setName('code')
      .setDescription('see /help locale for valid options')
      .setRequired(true));

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const languages = await Translator.listLocales();
  const locales = [];
  for (const language of languages) {
    locales.push(language.code);
  }
  const choice = interaction.options.getString('code').replace(sanitize, '').trim();
  if (locales.includes(choice)) {
    await db.updateUser(interaction.user.id, 'locale', choice);
    interaction.editReply(`Your locale is now ${choice}.`);
  } else {interaction.editReply(`${choice} doesn't appear to be a valid locale. Please check [here](https://cloud.google.com/translate/docs/languages) and try again.`);}
}
