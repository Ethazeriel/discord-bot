import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';
import * as utils from '../../utils.js';

export const data = new SlashCommandBuilder()
  .setName('dab')
  .setDescription('Sends a dab')
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Dab type')
      .setRequired(true)
      .addChoice('Random', 'random')
      .addChoice('Pride', 'pride')
      .addChoice('Progress pride', 'progressive')
      .addChoice('PoC pride', 'poc')
      .addChoice('Trans', 'trans')
      .addChoice('Agender', 'agender')
      .addChoice('Aromantic', 'aromantic')
      .addChoice('Asexual', 'asexual')
      .addChoice('Bigender', 'bigender')
      .addChoice('Demisexual', 'demisexual')
      .addChoice('Gay(men)', 'gaymen')
      .addChoice('Genderfluid', 'genderfluid')
      .addChoice('Genderqueer', 'genderqueer')
      .addChoice('Intersex', 'intersex')
      .addChoice('Lesbian', 'lesbian')
      .addChoice('Nonbinary', 'nonbinary')
      .addChoice('Pan', 'pan')
      .addChoice('Poly', 'poly'));

export async function execute(interaction:CommandInteraction) {
  utils.prideSticker(interaction, 'dab');
}