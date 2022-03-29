import { SlashCommandBuilder } from '@discordjs/builders';
import Translator from '../../translate.js';
import * as db from '../../database.js';
import { sanitize } from '../../regexes.js';
import validator from 'validator';
import fs from 'fs';
const { discord } = JSON.parse(fs.readFileSync(new URL('../../config.json', import.meta.url)));
const roles = discord.roles;

export const data = new SlashCommandBuilder()
  .setName('locale')
  .setDescription('Set your locale for bot functions and translation')
  .addStringOption(option =>
    option.setName('code')
      .setDescription('see /help locale for valid options')
      .setRequired(true));

export async function execute(interaction) {
  if (interaction.member?.roles?.cache?.some(role => role.name === roles.translate)) {
    await interaction.deferReply({ ephemeral: true });
    const choice = validator.escape(validator.stripLow(interaction.options.getString('code').replace(sanitize, ''))).trim();
    const locales = await Translator.getLocales();
    if (locales.filter(element => element.code === choice).length) {
      await db.updateUser(interaction.user.id, 'locale', choice);
      const organizer = Translator.getOrganizer(interaction.channelId);
      if (organizer && Object.keys(organizer.subscribers).includes(interaction.user.id)) {
        organizer.changeLocale(interaction.user.id, choice);
      }
      interaction.editReply(`Your locale is now ${choice}.`);
    } else {interaction.editReply(`${choice} doesn't appear to be a valid locale. Please check [here](https://cloud.google.com/translate/docs/languages) and try again.`);}
  } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
}
