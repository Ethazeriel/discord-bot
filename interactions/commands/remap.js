/* eslint-disable no-inner-declarations */
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageAttachment } = require('discord.js');
const { sanitize, youtubePattern } = require('../../regexes.js');
const db = require('../../database.js');
const utils = require('../../utils.js');
const Canvas = require('canvas');
// const music = require('../../music.js');
const Player = require('../../player.js');
const ytdl = require('ytdl-core');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('remap')
    .setDescription('remap incorrect tracks')
    .addStringOption(option => option.setName('track').setDescription('takes a youtube url or "current" for the currently playing track').setRequired(true))
    .addStringOption(option => option.setName('newtrack').setDescription('optional remap target')),


  async execute(interaction) {

    if (interaction.member?.roles?.cache?.some(role => role.name === 'DJ')) {
      await interaction.deferReply({ ephemeral: true });
      const search = interaction.options.getString('track')?.replace(sanitize, '')?.trim();
      const replace = interaction.options.getString('newtrack')?.replace(sanitize, '')?.trim();
      if (youtubePattern.test(search) || search === 'current') {
        if (replace) {
          if (youtubePattern.test(replace)) {
            const match = search.match(youtubePattern);
            const track = await db.getTrack({ 'youtube.id': match[2] });
            if (!Object.keys(track).length) {
              await interaction.followUp({ content:'We don\'t appear to have that track.', ephemeral: true });
              return;
            }
            const match2 = replace.match(youtubePattern);
            const newtrack = await ytdl.getBasicInfo(match2[2]);
            if (!Object.keys(newtrack).length) {
              await interaction.followUp({ content:'That new track doesn\'t appear to be valid', ephemeral: true });
              return;
            }
            const canvas = Canvas.createCanvas(960, 360);
            const context = canvas.getContext('2d');
            function drawtext(text, x, y) {// this is ugly and terrible and stolen, but I don't caaaaaaaaare
              context.font = '80px Sans-serif';
              context.strokeStyle = 'black';
              context.lineWidth = 8;
              context.strokeText(text, x, y);
              context.fillStyle = 'white';
              context.fillText(text, x, y);
            }
            const alt0 = await Canvas.loadImage(track.youtube.art);
            const alt1 = await Canvas.loadImage(`https://i.ytimg.com/vi/${newtrack.videoDetails.videoId}/hqdefault.jpg`);
            context.drawImage(alt0, 0, 0, 480, 360);
            context.drawImage(alt1, 480, 0, 480, 360);
            drawtext('From', 15, 70);
            drawtext('To', 500, 70);
            const combined = new MessageAttachment(canvas.toBuffer(), 'combined.png');
            const reply = {
              embeds: [
                {
                  color: 0xd64004,
                  author: {
                    name: 'Remapped:',
                    icon_url: utils.pickPride('fish'),
                  },
                  fields: [
                    { name: 'From:', value: `[${track.youtube.name}](https://youtube.com/watch?v=${track.youtube.id}) - ${new Date(track.youtube.duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                    { name: 'To:', value: `[${newtrack.videoDetails.title}](https://youtube.com/watch?v=${newtrack.videoDetails.videoId}) - ${new Date(newtrack.videoDetails.lengthSeconds * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                  ],
                  image: {
                    url: 'attachment://combined.png',
                  },
                  footer: {
                    text: `${track.youtube.id}${newtrack.videoDetails.videoId}`,
                  },
                },
              ],
              components: [
                {
                  'type': 1,
                  'components': [
                    {
                      'type': 2,
                      'custom_id': 'remap-new',
                      'style':3,
                      'label':'Confirm',
                    },
                    {
                      'type': 2,
                      'custom_id': 'remap-no',
                      'style':4,
                      'label':'Cancel',
                    },
                  ],
                },
              ],
              files: [combined],
            };
            await interaction.followUp(reply);

          } else { await interaction.followUp({ content:'Invalid newtrack URL', ephemeral: true });}
        } else {
          let track;
          if (search === 'current') {
            track = await Player.getPlayer(interaction)?.getCurrent();
            if (!Object.keys(track).length) {
              await interaction.followUp({ content:'Unable to get the current track; Is something playing?', ephemeral: true });
              return;
            }
          } else {
            const match = search.match(youtubePattern);
            track = await db.getTrack({ 'youtube.id': match[2] });
            if (!Object.keys(track).length) {
              await interaction.followUp({ content:'We don\'t appear to have that track.', ephemeral: true });
              return;
            }
          }
          const canvas = Canvas.createCanvas(960, 720);
          const context = canvas.getContext('2d');
          function drawtext(text, x, y) {// this is ugly and terrible and stolen, but I don't caaaaaaaaare
            context.font = '80px Sans-serif';
            context.strokeStyle = 'black';
            context.lineWidth = 8;
            context.strokeText(text, x, y);
            context.fillStyle = 'white';
            context.fillText(text, x, y);
          }
          const alt0 = await Canvas.loadImage(track.alternates[0].art);
          const alt1 = await Canvas.loadImage(track.alternates[1].art);
          const alt2 = await Canvas.loadImage(track.alternates[2].art);
          const alt3 = await Canvas.loadImage(track.alternates[3].art);
          context.drawImage(alt0, 0, 0, 480, 360);
          context.drawImage(alt1, 480, 0, 480, 360);
          context.drawImage(alt2, 0, 360, 480, 360);
          context.drawImage(alt3, 480, 360, 480, 360);
          drawtext('1', 15, 70);
          drawtext('2', 900, 70);
          drawtext('3', 15, 705);
          drawtext('4', 900, 705);
          const combined = new MessageAttachment(canvas.toBuffer(), 'combined.png');
          const reply = {
            embeds: [
              {
                color: 0xd64004,
                author: {
                  name: 'Remap:',
                  icon_url: utils.pickPride('fish'),
                },
                fields: [
                  { name: 'Spotify:', value: `${track.artist.name || 'no artist'} - ${track.spotify.name || 'no track name'} - ${new Date(track.spotify.duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                  { name: 'Current Youtube:', value: `[${track.youtube.name}](https://youtube.com/watch?v=${track.youtube.id}) - ${new Date(track.youtube.duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                  { name: '\u200b', value: '** **' },
                  { name: 'Alternate 1:', value: `[${track.alternates[0].name}](https://youtube.com/watch?v=${track.alternates[0].id}) - ${new Date(track.alternates[0].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                  { name: 'Alternate 2:', value: `[${track.alternates[1].name}](https://youtube.com/watch?v=${track.alternates[1].id}) - ${new Date(track.alternates[1].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                  { name: 'Alternate 3:', value: `[${track.alternates[2].name}](https://youtube.com/watch?v=${track.alternates[2].id}) - ${new Date(track.alternates[2].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                  { name: 'Alternate 4:', value: `[${track.alternates[3].name}](https://youtube.com/watch?v=${track.alternates[3].id}) - ${new Date(track.alternates[3].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                ],
                image: {
                  url: 'attachment://combined.png',
                },
                footer: {
                  text: track.youtube.id,
                },
              },
            ],
            components: [
              {
                'type': 1,
                'components': [
                  {
                    'type': 3,
                    'custom_id': 'remap',
                    'options':[
                      {
                        'label': 'Alternative 1',
                        'value': '0',
                        'description': track.alternates[0].name,
                      },
                      {
                        'label': 'Alternative 2',
                        'value': '1',
                        'description': track.alternates[1].name,
                      },
                      {
                        'label': 'Alternative 3',
                        'value': '2',
                        'description': track.alternates[2].name,
                      },
                      {
                        'label': 'Alternative 4',
                        'value': '3',
                        'description': track.alternates[3].name,
                      },
                      {
                        'label': 'Something else',
                        'value': '4',
                        'description': 'none of these are correct',
                      },
                    ],
                    'placeholder': 'Select track...',
                  },
                ],
              },
            ],
            files: [combined],
          };

          await interaction.followUp(reply);
        }
      } else { await interaction.followUp({ content:'Invalid track URL', ephemeral: true });}
    } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
  },

};
