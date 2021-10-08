const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageAttachment } = require('discord.js');
const Canvas = require('canvas');
const utils = require('../utils.js');

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
    const heartChoice = interaction.options.getString('type');
    if (heartChoice == 'random') { // do this if we've selected random hearts

      // rendering with a canvas means we can control the image size
      const canvas = Canvas.createCanvas(160, 160);
      const context = canvas.getContext('2d');
      const heartimg = await Canvas.loadImage(utils.pickPride('heart'));
      context.drawImage(heartimg, 0, 0, canvas.width, canvas.height);
      const attachment = new MessageAttachment(canvas.toBuffer(), 'heart-image.png');

      // push the message to chat
      await interaction.reply({ files: [attachment] });
    } else { // code for specific hearts
      const heartStr = 'https://ethazeriel.net/pride/sprites/heart_' + heartChoice + '.png';

      // rendering with a canvas means we can control the image size
      const canvas = Canvas.createCanvas(160, 160);
      const context = canvas.getContext('2d');
      const heartimg = await Canvas.loadImage(heartStr);
      context.drawImage(heartimg, 0, 0, canvas.width, canvas.height);
      const attachment = new MessageAttachment(canvas.toBuffer(), 'heart-image.png');

      // push the message to chat
      await interaction.reply({ files: [attachment] });
    }

  },

};
