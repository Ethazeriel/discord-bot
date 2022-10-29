import { ContextMenuCommandBuilder } from '@discordjs/builders';
import * as db from '../../database.js';
import Translator from '../../translate.js';
import validator from 'validator';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { GuildMember, GuildMemberRoleManager, MessageContextMenuCommandInteraction } from 'discord.js';
const { discord } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../../config.json', import.meta.url).toString()), 'utf-8'));
const roles = discord.roles;

export const data = new ContextMenuCommandBuilder()
  .setName('Translate this')
  .setType(3); // type 3 for message, 2 for user

export async function execute(interaction:MessageContextMenuCommandInteraction) {
  if ((interaction.member?.roles as GuildMemberRoleManager)?.cache?.some(role => role.name === roles.translate)) {
    await interaction.deferReply({ ephemeral: true });
    const user = await db.getUser(interaction.user.id);
    if (user!.discord?.locale) {
      const translation = await Translator.translate(validator.escape(validator.stripLow(interaction.targetMessage.content || '')).trim(), user!.discord.locale);
      await interaction.followUp(`${(interaction.member as GuildMember).displayName}: ${validator.unescape(translation)}`);
    } else {await interaction.followUp('You need to set your locale using "/locale" first');}
  } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
}