import fs from 'fs';
import { v2 } from '@google-cloud/translate';
import { logDebug, log } from './logger.js';
import * as utils from './utils.js';
import { fileURLToPath } from 'url';
const { apiKey } = JSON.parse(fs.readFileSync(fileURLToPath(new URL('../config.json', import.meta.url).toString()), 'utf-8')).translate;
import validator from 'validator';
import { ButtonInteraction, CommandInteraction, InteractionReplyOptions, Message, MessageEmbedOptions } from 'discord.js';
import { DetectResult } from '@google-cloud/translate/build/src/v2';

export default class Translator {
  // types
  id:string;
  subscribers:Record<string, {
    locale:string
    id:string
    interaction:CommandInteraction | ButtonInteraction
    expiry:NodeJS.Timeout
  }>;
  targets:Set<string>;
  // class
  static #organizers:Record<string, Translator> = {};
  static #GTranslate = new v2.Translate({ key:apiKey });
  static locales:{code:string, name:string}[] = [];
  static #localetimestamp = 0;
  constructor(channel:string) {
    this.id = channel;
    this.subscribers = {};
    this.targets = new Set();
    Translator.#refreshLocales();
  }

  static subscribe(channel:string, user:string, locale:string, interaction:CommandInteraction | ButtonInteraction) {
    const listener = Translator.#organizers[channel] || (Translator.#organizers[channel] = new Translator(channel));
    listener.getSubscriber(user) ? listener.changeLocale(user, locale) : listener.addSubscriber(user, locale, interaction);
    return listener;
  }

  static getOrganizer(channel:string) {
    return Translator.#organizers[channel] ? Translator.#organizers[channel] : null;
  }

  static async #refreshLocales() { // updates our locale list if >24hrs old
    const now = Date.now();
    if ((now - Translator.#localetimestamp) > 86400000) {
      let locales:{code:string, name:string}[] = [];
      try { [locales] = await Translator.#GTranslate.getLanguages(); } catch (error:any) {
        log('error', [`Translate error: ${error.message}`]);
      }
      Translator.locales = locales;
      Translator.#localetimestamp = Date.now();
    }
  }

  static async getLocales() { // returns array of locales in format { code:'en', name:'English' }
    await Translator.#refreshLocales();
    return Translator.locales;
  }

  static async getLang(text:string) { // takes string, returns object { code:'en', name:'English' }
    let detected:DetectResult;
    try { [detected] = await Translator.#GTranslate.detect(text); } catch (error:any) {
      log('error', [`Translate error: ${error.message}`]);
    }
    const [language] = Translator.locales.filter(element => element.code === detected.language);
    return language;
  }

  static async toEnglish(text:string) {
    await Translator.#refreshLocales();
    let translation = '';
    try { [translation] = await Translator.#GTranslate.translate(text, 'en'); } catch (error:any) {
      log('error', [`Translate error: ${error.message}`]);
    }
    // console.log(text, translation);
    return translation;
  }

  static async translate(text:string, target:string) {
    await Translator.#refreshLocales();
    let translation = '';
    try { [translation] = await Translator.#GTranslate.translate(text, target); } catch (error:any) {
      log('error', [`Translate error: ${error.message}`]);
    }
    // console.log(text, translation);
    return translation;
  }

  static langEmbed(src:string, srcloc:string, srcusr:string, dest:string, destloc:string):MessageEmbedOptions {
    srcloc = Translator.locales.filter(element => element.code === srcloc)[0].name;
    destloc = Translator.locales.filter(element => element.code === destloc)[0].name;
    const embed = {
      color: utils.randomHexColor(),
      author: {
        name: `${srcusr} translated`,
        icon_url: utils.pickPride('fish'),
      },
      fields: [
        { name: `From ${srcloc}`, value: src },
        { name: `To ${destloc}`, value: dest },
      ],
    };
    return embed as MessageEmbedOptions;
  }

  static messageEventDispatch(message:Message) {
    if (Translator.#organizers[message.channelId]) { Translator.#organizers[message.channelId].messageEvent(message); }
  }

  async messageEvent(message:Message) {
    await Translator.#refreshLocales();
    const messageContent = validator.escape(validator.stripLow(message.content || '')).trim();
    const translations:Record<string, string> = {};
    for (const locale of this.targets) {
      try {
        const [result] = await Translator.#GTranslate.translate(messageContent, locale);
        translations[locale] = result || 'translate failed';
      } catch (error:any) {
        log('error', [`Translate error: ${error.message}`]);
      }
    }
    // console.log(translations);
    for (const sub in this.subscribers) {
      if (sub !== message.author.id) {
        this.subscribers[sub].interaction.followUp({ content:validator.unescape(translations[this.subscribers[sub].locale]), ephemeral:true });
      }
    }
  }

  getSubscriber(user:string) {
    return this.subscribers[user];
  }

  changeLocale(user:string, locale:string) {
    logDebug(`Updating locale for ${user} to ${locale}`);
    this.subscribers[user].locale = locale;
    this.updateTargets();
  }

  addSubscriber(user:string, locale:string, interaction:CommandInteraction | ButtonInteraction) {
    logDebug(`adding sub ${user} with ${locale}`);
    this.subscribers[user] = {
      locale: locale,
      id: user,
      interaction:interaction,
      expiry: setTimeout(() => {
        clearTimeout(this.subscribers[user].expiry);
        const button = { type: 2, custom_id: 'translate-refresh', style: 3, label: 'Refresh', disabled: false };
        interaction.followUp({ content:'Discord imposes a 15-minute timeout on interactions - if you want to keep receiving translations, please hit this refresh button.', components:[{ type: 1, components:[button] }], ephemeral:true } as InteractionReplyOptions);
        this.removeSubscriber(user);
      }, 885000).unref(),
    };
    this.updateTargets();
  }

  removeSubscriber(user:string) {
    delete this.subscribers[user];
    if (Object.keys(this.subscribers).length) {
      this.updateTargets();
    } else {
      logDebug(`Removing translate organizer with id ${this.id}`);
      delete Translator.#organizers[this.id];
    }
  }

  updateTargets() { // updates the set of languages we need to translate to
    this.targets.clear();
    for (const user in this.subscribers) {
      this.targets.add(this.subscribers[user].locale);
    }
  }
}