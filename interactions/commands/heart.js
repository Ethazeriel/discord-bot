const { SlashCommandBuilder } = require('@discordjs/builders');
const utils = require('../../utils.js');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('heart')
    .setDescription('Sends a heart')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('heart type')
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
        .addChoice('Poly', 'poly')),

  async execute(interaction) {
    utils.prideSticker(interaction, 'heart');
  },

};
