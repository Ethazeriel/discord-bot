/* eslint-disable no-inner-declarations */
const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageAttachment } = require('discord.js');
const { logLine } = require('../logger.js');
const { sanitize, youtubePattern } = require('../regexes.js');
const db = require('../database.js');
const utils = require('../utils.js');
const Canvas = require('canvas');
const music = require('../music.js');
const { fetch } = require('../acquire.js');


module.exports = {
  data: new SlashCommandBuilder()
    .setName('remap')
    .setDescription('remap incorrect tracks')
    .addStringOption(option => option.setName('track').setDescription('takes a youtube url or "current" for the currently playing track').setRequired(true))
    .addStringOption(option => option.setName('newtrack').setDescription('optional remap target')),


  async execute(interaction) {
    logLine('command',
      ['Recieved command from ',
        interaction.member.displayName,
        'with name ',
        interaction.commandName,
        'track ',
        interaction.options.getString('track')?.replace(sanitize, '')]);

    if (interaction.member.roles.cache.some(role => role.name === 'DJ')) {
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
            const newtrack = await fetch(replace);
            if (!newtrack.length) {
              await interaction.followUp({ content:'Invalid newtrack URL', ephemeral: true });
              return;
            }

            if (newtrack[0].ephemeral) { // ephemeral track - we can just do an update by spotify ID
              const query = { 'spotify.id':newtrack[0].spotify.id };
              const update = { $set: { 'youtube':newtrack[0].youtube } };
              if (track.keys.length && (track.keys != newtrack[0].keys)) {
                const newkeys = track.keys.concat(newtrack[0].keys);
                update['$set']['keys'] = newkeys;
              }
              if (Object.keys(track.playlists).length && (track.playlists != newtrack[0].playlists)) {
                const newplaylists = Object.assign(track.playlists, newtrack[0].playlists);
                update['$set']['playlists'] = newplaylists;
              }
              if (track.spotify.id.length && (track.spotify.id != newtrack[0].spotify.id)) {
                const newid = track.spotify.id.concat(newtrack[0].spotify.id);
                update['$set']['spotify.id'] = newid;
              }

              await db.updateTrack(query, update);
              await db.removeTrack(track.youtube.id);
            } else {
              const query = { 'youtube.id':newtrack[0].youtube.id };
              const update = { $set: {} };
              if (track.keys.length && (track.keys != newtrack[0].keys)) {
                const newkeys = track.keys.concat(newtrack[0].keys);
                update['$set']['keys'] = newkeys;
              }
              if (Object.keys(track.playlists).length && (track.playlists != newtrack[0].playlists)) {
                const newplaylists = Object.assign(track.playlists, newtrack[0].playlists);
                update['$set']['playlists'] = newplaylists;
              }
              if (track.spotify.id.length && (track.spotify.id != newtrack[0].spotify.id)) {
                const newid = track.spotify.id.concat(newtrack[0].spotify.id);
                update['$set']['spotify.id'] = newid;
              }
              if (Object.keys(update.$set).length > 0) {
                await db.updateTrack(query, update);
              }
              await db.removeTrack(track.youtube.id);
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
            const alt1 = await Canvas.loadImage(newtrack[0].youtube.art);
            context.drawImage(alt0, 0, 0, 480, 360);
            context.drawImage(alt1, 480, 0, 480, 360);
            drawtext('From', 15, 70);
            drawtext('To', 500, 70);
            const combined = new MessageAttachment(canvas.toBuffer(), 'combined.png');
            const reply = {
              embeds:
            [
              {
                color: 0xd64004,
                author: {
                  name: 'Remapped:',
                  icon_url: utils.pickPride('fish'),
                },
                fields: [
                  { name: 'From:', value: `[${track.youtube.name}](https://youtube.com/watch?v=${track.youtube.id}) - ${new Date(track.youtube.duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                  { name: 'To:', value: `[${newtrack[0].youtube.name}](https://youtube.com/watch?v=${newtrack[0].youtube.id}) - ${new Date(newtrack[0].youtube.duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
                ],
                image: {
                  url: 'attachment://combined.png',
                },
              },
            ],
              files: [combined] };
            await interaction.followUp(reply);


          } else { await interaction.followUp({ content:'Invalid newtrack URL', ephemeral: true });}
        } else {
          let track;
          if (search === 'current') {
            track = music.getCurrentTrack();
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
            embeds:
          [
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
            components:
      [
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
            files: [combined] };

          await interaction.followUp(reply);
        }
      } else { await interaction.followUp({ content:'Invalid track URL', ephemeral: true });}
    } else { await interaction.reply({ content:'You don\'t have permission to do that.', ephemeral: true });}
  },

  async select(interaction) { // dropdown selection function
    const choice = interaction.values[0];
    if (choice < 4) {
      const track = await db.getTrack({ 'youtube.id': interaction.message.embeds[0].footer.text });
      const reply = {
        embeds:
      [
        {
          color: 0xd64004,
          author: {
            name: 'Confirm remap:',
            icon_url: utils.pickPride('fish'),
          },
          fields: [
            { name: 'From:', value: `[${track.youtube.name}](https://youtube.com/watch?v=${track.youtube.id}) - ${new Date(track.youtube.duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
            { name: 'To:', value: `[${track.alternates[choice].name}](https://youtube.com/watch?v=${track.alternates[choice].id}) - ${new Date(track.alternates[choice].duration * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '')}` },
          ],
          image: {
            url: 'attachment://combined.png',
            height: 0,
            width: 0,
          },
          footer: {
            text: interaction.message.embeds[0].footer.text + choice,
          },
        },
      ],
        components:
  [
    {
      'type': 1,
      'components': [
        {
          'type': 2,
          'custom_id': 'remap-yes',
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
  ] };
      await interaction.update(reply);
    } else {
      const reply = {
        embeds:
      [
        {
          color: 0xd64004,
          author: {
            name: 'Manual remap:',
            icon_url: utils.pickPride('fish'),
          },
          fields: [
            { name: 'For a manual remap, use:', value: `/remap track:https://youtube.com/watch?v=${interaction.message.embeds[0].footer.text} newtrack:youtube_link_here` },
          ],
          image: {
            url: 'attachment://combined.png',
            height: 0,
            width: 0,
          },
        },
      ],
        components:[] };
      await interaction.update(reply);
    }
  },

  async button(interaction, which) { // button selection function
    const match = interaction.message.embeds[0].footer.text.match(/([\w-]{11})([0-3])/);
    switch (which) {
    case 'yes': {
      const result = await db.switchAlternate(match[1], match[2]);
      if (result) {
        const reply = {
          embeds:
        [
          {
            color: 0xd64004,
            author: {
              name: 'Confirmed:',
              icon_url: utils.pickPride('fish'),
            },
            fields: [
              { name: 'Track Remapped.', value: '** **' },
            ],
            image: {
              url: 'attachment://combined.png',
              height: 0,
              width: 0,
            },
          },
        ],
          components:[] };
        await interaction.update(reply);
      } else {
        const reply = {
          embeds:
        [
          {
            color: 0xd64004,
            author: {
              name: 'Failure:',
              icon_url: utils.pickPride('fish'),
            },
            fields: [
              { name: 'Something went wrong;', value: 'please try again.' },
            ],
            image: {
              url: 'attachment://combined.png',
              height: 0,
              width: 0,
            },
          },
        ],
          components:[] };
        await interaction.update(reply);
      }
      break;
    }

    case 'no': {
      const reply = {
        embeds:
        [
          {
            color: 0xd64004,
            author: {
              name: 'Cancelled remap.',
              icon_url: utils.pickPride('fish'),
            },
            image: {
              url: 'attachment://combined.png',
              height: 0,
              width: 0,
            },
          },
        ],
        components:[] };
      await interaction.update(reply);
      break;
    }
    default:
      break;
    }
  },
};
