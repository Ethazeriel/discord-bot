import { ContextMenuCommandBuilder } from '@discordjs/builders';
import * as db from '../../database.js';
import Translator from '../../translate.js';
import validator from 'validator';
import fs from 'fs';
const { discord } = JSON.parse(fs.readFileSync(new URL('../../../config.json', import.meta.url)));
const roles = discord.roles;

export const data = new ContextMenuCommandBuilder()
  .setName('Translate this')
  .setType(3); // type 3 for message, 2 for user

export async function execute(interaction) {
  if (interaction.member?.roles?.cache?.some(role => role.name === roles.translate)) {
    await interaction.deferReply({ ephemeral: true });
    const user = await db.getUser(interaction.user.id);
    if (user.discord?.locale) {
      const translation = await Translator.translate(validator.escape(validator.stripLow(interaction.targetMessage.content || '')).trim(), user.discord.locale);
      await interaction.followUp(`${interaction.member.displayName}: ${validator.unescape(translation)}`);
    } else {await interaction.followUp('You need to set your locale using "/locale" first');}
  } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
}