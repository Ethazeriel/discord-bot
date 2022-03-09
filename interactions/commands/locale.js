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
  const choice = interaction.options.getString('code').replace(sanitize, '').trim();
  const locales = await Translator.getLocales();
  if (locales.filter(element => element.code === choice).length) {
    await db.updateUser(interaction.user.id, 'locale', choice);
    const organizer = Translator.getOrganizer(interaction.channelId);
    if (organizer && Object.keys(organizer.subscribers).includes(interaction.user.id)) {
      organizer.changeLocale(interaction.user.id, choice);
    }
    interaction.editReply(`Your locale is now ${choice}.`);
  } else {interaction.editReply(`${choice} doesn't appear to be a valid locale. Please check [here](https://cloud.google.com/translate/docs/languages) and try again.`);}
}
