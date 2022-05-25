import { SlashCommandBuilder } from '@discordjs/builders';
import * as utils from '../../utils.js';
import type { CommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('heart')
  .setDescription('Sends a heart')
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Heart type')
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
  utils.prideSticker(interaction, 'heart');
}
