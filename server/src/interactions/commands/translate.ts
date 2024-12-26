/* eslint-disable no-case-declarations */
import { SlashCommandBuilder } from '@discordjs/builders';
import Translator from '../../translate.js';
import * as db from '../../database.js';
import validator from 'validator';
import fs from 'fs';
import { fileURLToPath, URL } from 'url';
import { ChatInputCommandInteraction, GuildMember, GuildMemberRoleManager } from 'discord.js';
const { discord }:GooseConfig = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../../../../config.json', import.meta.url).toString()), 'utf-8'));
const roles = discord.roles;

export const data = new SlashCommandBuilder()
  .setName('translate')
  .setDescription('Chat translation functions')
  .addSubcommand(subcommand => subcommand
    .setName('to_english')
    .setDescription('translates your input to english and posts it in chat')
    .addStringOption(option =>
      option.setName('text').setDescription('what to translate').setRequired(true)))
  .addSubcommand(subcommand => subcommand
    .setName('subscribe')
    .setDescription('Subscribes you to translations for this channel'));

export async function execute(interaction:ChatInputCommandInteraction) {
  if ((interaction.member?.roles as GuildMemberRoleManager)?.cache?.some(role => role.name === roles.translate)) {
    const action = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: (action === 'to_english') ? false : true });
    switch (action) {
      case 'to_english':
        const text = validator.escape(validator.stripLow(interaction.options.getString('text') || '')).trim();
        const response = await Translator.toEnglish(text);
        const language = await Translator.getLang(text);

        response ? await interaction.followUp({ embeds:[Translator.langEmbed(validator.unescape(text), language.code, (interaction.member as GuildMember).displayName, validator.unescape(response), 'en')] }) : await interaction.followUp('it didn\'t work');
        break;

      case 'subscribe':
        const user = await db.getUser(interaction.user.id);
        if (user!.discord?.locale) {
          Translator.subscribe(interaction.channelId, interaction.user.id, user!.discord.locale, interaction);
          await interaction.followUp(`Messages in this channel will now be translated to your locale: ${user!.discord.locale}`);
        } else {await interaction.followUp('You need to set your locale using "/locale" first');}
        break;

      default:
        break;
    }
  } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
}
