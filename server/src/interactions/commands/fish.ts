import { SlashCommandBuilder } from '@discordjs/builders';
import type { ChatInputCommandInteraction } from 'discord.js';
import * as utils from '../../utils.js';

export const data = new SlashCommandBuilder()
  .setName('fish')
  .setDescription('Sends a fish')
  .addStringOption(option =>
    option.setName('type')
      .setDescription('Fish type')
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
  utils.prideSticker(interaction, 'fish');
}
