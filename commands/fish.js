const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageAttachment } = require('discord.js');
const Canvas = require('canvas');
const utils = require('../utils.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fish')
    .setDescription('Sends a Fish')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Fish type')
        .setRequired(true)
        .addChoice('Random', 'random')
        .addChoice('Pride', 'pride')
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
    console.log(`Recieved command from ${interaction.member} with name ${interaction.commandName}, type: ${interaction.options.getString('type')}`);
    const fishChoice = interaction.options.getString('type');
    if (fishChoice == 'random') { // do this if we've selected random fishs

      // rendering with a canvas means we can control the image size
      const canvas = Canvas.createCanvas(160, 160);
      const context = canvas.getContext('2d');
      const fishimg = await Canvas.loadImage(utils.pickPride('fish'));
      context.drawImage(fishimg, 0, 0, canvas.width, canvas.height);
      const attachment = new MessageAttachment(canvas.toBuffer(), 'fish-image.png');

      // push the message to chat
      await interaction.reply({ files: [attachment] });
    } else { // code for specific fishs
      const fishStr = 'https://ethazeriel.net/pride/sprites/fish_' + fishChoice + '.png';

      // rendering with a canvas means we can control the image size
      const canvas = Canvas.createCanvas(160, 160);
      const context = canvas.getContext('2d');
      const fishimg = await Canvas.loadImage(fishStr);
      context.drawImage(fishimg, 0, 0, canvas.width, canvas.height);
      const attachment = new MessageAttachment(canvas.toBuffer(), 'fish-image.png');

      // push the message to chat
      await interaction.reply({ files: [attachment] });
    }

  },

};
