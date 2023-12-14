import { CommandInteraction, AttachmentBuilder, InteractionReplyOptions } from 'discord.js';

// import Player from './player.js';
// import * as utils from './utils.js';
// import * as db from './database.js';
// import { logDebug } from './logger.js';
import { logDebug, Player, db, utils } from './internal.js';

export class Workspace {

  list:Track[];
  id:string;
  expiry:NodeJS.Timeout;

  static #workspaces: Record<string, Workspace> = {};
  constructor(userid:string) {
    this.list = [];
    this.id = userid;
    this.expiry = setTimeout(() => {
      logDebug(`Timeout reached; removing workspace for user ${this.id}`);
      Workspace.clearWorkspace(this.id);
    }, 3600000).unref(); // hour timeout to clear workspaces that haven't been interacted with
  }

  static getWorkspace(userid:string) {
    const workspace = Workspace.#workspaces[userid] || (Workspace.#workspaces[userid] = new Workspace(userid));
    return workspace;
  }

  static clearWorkspace(userid:string) {
    delete Workspace.#workspaces[userid];
  }

  removeTrack(index:number) {
    this.expiry.refresh();
    this.list.splice(index, 1);
  }

  emptyList() {
    this.expiry.refresh();
    this.list.length = 0;
  }

  async importQueue(interaction:CommandInteraction) {
    this.expiry.refresh();
    const { player, message } = await Player.getPlayer(interaction);
    if (player) {
      const queue = player.getQueue();
      this.list.push(...queue);
      interaction.followUp({ content: `Copied ${queue.length} items from the play queue to the workspace`, ephemeral: true });
    } else { interaction.editReply({ content: message }); }
  }

  addTracks(tracks:Track[], index:number) {
    this.expiry.refresh();
    let where = index;
    for (const track of tracks) {
      this.list.splice(where, 0, track);
      where++;
    }
    return this.list.length;
  }

  moveTrack(fromindex:number, toindex:number) {
    this.expiry.refresh();
    const track = this.list.splice(fromindex, 1);
    this.list.splice(toindex, 0, track[0]);
    return track;
  }

  async makeEmbed(messagetitle:string, page:number, fresh = true):Promise<InteractionReplyOptions> {
    this.expiry.refresh();
    page = Math.abs(page) || 1;
    const thumb = fresh ? (new AttachmentBuilder(utils.pickPride('dab')as string, { name:'thumb.jpg' })) : null;
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
      return fresh ? { embeds: [{ color: 0xfc1303, title: 'Nothing to show!', thumbnail: { url: 'attachment://thumb.jpg' } }], components: buttonEmbed, files: [thumb!], ephemeral: true } : { embeds: [{ color: 0xfc1303, title: 'Nothing to show!', thumbnail: { url: 'attachment://thumb.jpg' } }], components: buttonEmbed, ephemeral: true };
    }
    if (page > pages) { page = pages; }
    const queuePart = this.list.slice((page - 1) * 10, page * 10);
    let queueStr = '';
    for (let i = 0; i < queuePart.length; i++) {
      const dbtrack = await db.getTrack({ 'goose.id':queuePart[i].goose.id });
      let songName = dbtrack!.goose.track.name || 'Unnamed Track';
      if (songName.length > 250) { songName = songName.slice(0, 250).concat('...'); }
      const part = `**${((page - 1) * 10 + (i + 1))}. **${(dbtrack!.goose.artist.name || ' ')} - [${songName}](${dbtrack?.youtube[0].url}) - ${utils.timeDisplay(dbtrack?.youtube[0].duration || 0)} \n`;
      queueStr = queueStr.concat(part);
    }
    let queueTime = 0;
    for (const item of this.list) { queueTime = queueTime + Number(item.goose.track.duration); }
    const embed = {
      color: utils.randomHexColor(),
      author: {
        name: messagetitle,
        icon_url: utils.pickPride('fish'),
      },
      thumbnail: {
        url: 'attachment://thumb.jpg',
      },
      description: queueStr,
      fields: [
        { name: '\u200b', value: `Page ${page} of ${pages}`, inline: true },
        { name: '\u200b', value: `Playlist length: ${this.list.length} tracks`, inline: true },
        { name: '\u200b', value: `Duration: ${utils.timeDisplay(queueTime)}`, inline: true },
      ],
    };
    return fresh ? { embeds: [embed], components: buttonEmbed, files: [thumb!] } as InteractionReplyOptions : { embeds: [embed], components: buttonEmbed } as InteractionReplyOptions;
  }

}