import { SlashCommandBuilder } from '@discordjs/builders';
import * as utils from '../../utils.js';
import type { ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('heart')
  .setDescription('Sends a heart')
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Heart type')
      .setRequired(true)
      .addChoices({ name:'Random', value:'random' },
        { name:'Pride', value:'pride' },
        { name:'Progress pride', value:'progressive' },
        { name:'PoC pride', value:'poc' },
        { name:'Trans', value:'trans' },
        { name:'Agender', value:'agender' },
        { name:'Aromantic', value:'aromantic' },
        { name:'Asexual', value:'asexual' },
        { name:'Bigender', value:'bigender' },
        { name:'Demisexual', value:'demisexual' },
        { name:'Gay(men)', value:'gaymen' },
        { name:'Genderfluid', value:'genderfluid' },
        { name:'Genderqueer', value:'genderqueer' },
        { name:'Intersex', value:'intersex' },
        { name:'Lesbian', value:'lesbian' },
        { name:'Nonbinary', value:'nonbinary' },
        { name:'Pan', value:'pan' },
        { name:'Poly', value:'poly' }));

export async function execute(interaction:ChatInputCommandInteraction) {
  utils.prideSticker(interaction, 'heart');
}
