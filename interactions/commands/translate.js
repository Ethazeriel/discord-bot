/* eslint-disable no-case-declarations */
import { SlashCommandBuilder } from '@discordjs/builders';
import Translator from '../../translate.js';
import * as db from '../../database.js';

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

export async function execute(interaction) {
  const action = interaction.options.getSubcommand();
  await interaction.deferReply({ ephemeral: (action === 'to_english') ? false : true });
  switch (action) {
    case 'to_english':
      const response = await Translator.toEnglish(interaction.options.getString('text')); // TODO - will need to be sanitized
      const language = await Translator.getLang(interaction.options.getString('text'));

      response ? await interaction.followUp({ embeds:[Translator.langEmbed(interaction.options.getString('text'), language.code, interaction.member.displayName, response, 'en')] }) : await interaction.followUp('it didn\'t work');
      break;

    case 'subscribe':
      const user = await db.getUser(interaction.user.id);
      if (user.discord.locale) {
        Translator.subscribe(interaction.channelId, interaction.user.id, user.discord.locale, interaction);
        await interaction.followUp(`Messages in this channel will now be translated to your locale: ${user.discord.locale}`);
      } else {await interaction.followUp('You need to se your locale using "/locale" first');}
      break;

    default:
      break;
  }
}
