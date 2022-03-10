import fs from 'fs';
import { v2 } from '@google-cloud/translate';
import { logDebug, logLine } from './logger.js';
import * as utils from './utils.js';
const { apiKey } = JSON.parse(fs.readFileSync('./config.json')).translate;

export default class Translator {
  static #organizers = {};
  static #GTranslate = new v2.Translate({ key:apiKey });
  static locales = [];
  static #localetimestamp = 0;
  constructor(channel) {
    this.id = channel;
    this.subscribers = {};
    this.targets = new Set();
    Translator.#refreshLocales();
  }

  static subscribe(channel, user, locale, interaction) {
    const listener = Translator.#organizers[channel] || (Translator.#organizers[channel] = new Translator(channel));
    listener.getSubscriber(user) ? listener.changeLocale(user, locale) : listener.addSubscriber(user, locale, interaction);
    return listener;
  }

  static getOrganizer(channel) {
    return Translator.#organizers[channel] ? Translator.#organizers[channel] : null;
  }

  static async #refreshLocales() { // updates our locale list if >24hrs old
    const now = Date.now();
    if ((now - Translator.#localetimestamp) > 86400000) {
      let locales = '';
      try { [locales] = await Translator.#GTranslate.getLanguages(); } catch (error) {
        logLine('error', [`Translate error: ${error.message}`]);
      }
      Translator.locales = locales;
      Translator.#localetimestamp = Date.now();
    }
  }

  static async getLocales() { // returns array of locales in format { code:'en', name:'English' }
    await Translator.#refreshLocales();
    return Translator.locales;
  }

  static async getLang(text) { // takes string, returns object { code:'en', name:'English' }
    let detected = '';
    try { [detected] = await Translator.#GTranslate.detect(text); } catch (error) {
      logLine('error', [`Translate error: ${error.message}`]);
    }
    const [language] = Translator.locales.filter(element => element.code === detected.language);
    return language;
  }

  static async toEnglish(text) {
    await Translator.#refreshLocales();
    let translation = '';
    try { [translation] = await Translator.#GTranslate.translate(text, 'en'); } catch (error) {
      logLine('error', [`Translate error: ${error.message}`]);
    }
    // console.log(text, translation);
    return translation;
  }

  static async translate(text, target) {
    await Translator.#refreshLocales();
    let translation = '';
    try { [translation] = await Translator.#GTranslate.translate(text, target); } catch (error) {
      logLine('error', [`Translate error: ${error.message}`]);
    }
    // console.log(text, translation);
    return translation;
  }

  static langEmbed(src, srcloc, srcusr, dest, destloc) {
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
    return embed;
  }

  static messageEventDispatch(message) {
    if (Translator.#organizers[message.channelId]) { Translator.#organizers[message.channelId].messageEvent(message); }
  }

  async messageEvent(message) {
    await Translator.#refreshLocales();
    const messageContent = message.content;
    const translations = {};
    for (const locale of this.targets) {
      try {
        const [result] = await Translator.#GTranslate.translate(messageContent, locale);
        translations[locale] = result || 'translate failed';
      } catch (error) {
        logLine('error', [`Translate error: ${error.message}`]);
      }
    }
    // console.log(translations);
    for (const sub in this.subscribers) {
      if (sub !== message.author.id) {
        this.subscribers[sub].interaction.followUp({ content:translations[this.subscribers[sub].locale], ephemeral:true });
      }
    }
  }

  getSubscriber(user) {
    return this.subscribers[user];
  }

  changeLocale(user, locale) {
    logDebug(`Updating locale for ${user} to ${locale}`);
    this.subscribers[user].locale = locale;
    this.updateTargets();
  }

  addSubscriber(user, locale, interaction) {
    logDebug(`adding sub ${user} with ${locale}`);
    this.subscribers[user] = {
      locale: locale,
      id: user,
      interaction:interaction,
      expiry: setTimeout(() => {
        clearTimeout(this.subscribers[user].expiry);
        interaction.followUp({ content:'Discord imposes a 15-minute timeout on interactions - if you want to keep receiving translations, please hit this refresh button.', components:[{ type: 1, components:[{ type: 2, custom_id: 'translate-refresh', style: 3, label: 'Refresh', disabled: false }] }], ephemeral:true });
        this.removeSubscriber(user);
      }, 885000).unref(),
    };
    this.updateTargets();
  }

  removeSubscriber(user) {
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