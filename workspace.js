const Player = require('./player.js');
const { MessageAttachment } = require('discord.js');
const utils = require('./utils.js');
const db = require('./database.js');

class Workspace {
  static #workspaces = {};
  constructor(userid) {
    this.list = [];
    this.id = userid;
  }

  static getWorkspace(userid) {
    const workspace = Workspace.#workspaces[userid] || (Workspace.#workspaces[userid] = new Workspace(userid));
    return workspace;
  }

  removeTrack(index) {
    this.list.splice(index, 1);
  }

  emptyList() {
    this.list.length = 0;
  }

  async importQueue(interaction) {
    const player = await Player.getPlayer(interaction);
    if (player) {
      const queue = player.getQueue();
      this.list.push(...queue);
      interaction.followUp({ content: `Copied ${queue.length} items from the play queue to the workspace`, ephemeral: true });
    }
  }

  addTracks(tracks, index) {
    let where = index;
    for (const track of tracks) {
      this.list.splice(where, 0, track);
      where++;
    }
    return this.list.length;
  }

  moveTrack(fromindex, toindex) {
    const track = this.list.splice(fromindex, 1);
    this.list.splice(toindex, 0, track[0]);
    return track;
  }

  async makeEmbed(messagetitle, page, fresh = true) {
    page = Math.abs(page) || 1;
    const thumb = fresh ? (new MessageAttachment(utils.pickPride('dab'), 'thumb.jpg')) : null;
    const pages = Math.ceil(this.list.length / 10); // this should be the total number of pages? rounding up
    const buttonEmbed = [ {
      type: 1,
      components: [
        { type: 2, custom_id: 'list-prev', style:2, label:'Previous', disabled: (page === 1) ? true : false },
        { type: 2, custom_id: 'list-refresh', style:1, label:'Refresh' },
        { type: 2, custom_id: 'list-next', style:2, label:'Next', disabled: (page === pages) ? true : false },
      ],
    }];
    if (pages === 0) {
      return fresh ? { embeds: [{ color: 0xfc1303, title: 'Nothing to show!', thumbnail: { url: 'attachment://thumb.jpg' } }], components: buttonEmbed, files: [thumb], ephemeral: true } : { embeds: [{ color: 0xfc1303, title: 'Nothing to show!', thumbnail: { url: 'attachment://thumb.jpg' } }], components: buttonEmbed, ephemeral: true };
    }
    if (page > pages) { page = pages; }
    const queuePart = this.list.slice((page - 1) * 10, page * 10);
    let queueStr = '';
    for (let i = 0; i < queuePart.length; i++) {
      const dbtrack = await db.getTrack({ 'goose.id':queuePart[i].goose.id });
      const part = `**${((page - 1) * 10 + (i + 1))}. **${(dbtrack.artist.name || ' ')} - [${(dbtrack.spotify.name || dbtrack.youtube.name)}](https://youtube.com/watch?v=${dbtrack.youtube.id}) - ${utils.timeDisplay(dbtrack.youtube.duration)} \n`;
      queueStr = queueStr.concat(part);
    }
    let queueTime = 0;
    for (const item of this.list) { queueTime = queueTime + Number(item.youtube.duration || item.spotify.duration); }
    const queueEmbed = {
      color: utils.randomHexColor(),
      author: {
        name: messagetitle,
        icon_url: utils.pickPride('fish'),
      },
      thumbnail: {
        url: 'attachment://thumb.jpg',
      },
      fields: [
        { name: 'Horse:', value: queueStr },
        { name: '\u200b', value: `Page ${page} of ${pages}`, inline: true },
        { name: '\u200b', value: `Playlist length: ${this.list.length} tracks`, inline: true },
        { name: '\u200b', value: `Duration: ${utils.timeDisplay(queueTime)}`, inline: true },
      ],
    };
    return fresh ? { embeds: [queueEmbed], components: buttonEmbed, files: [thumb] } : { embeds: [queueEmbed], components: buttonEmbed };
  }

}
exports.Workspace = Workspace;
exports.getWorkspace = Workspace.getWorkspace;