import fs from 'fs';
import { v2 } from '@google-cloud/translate';
import { logLine } from './logger.js';
const { apiKey } = JSON.parse(fs.readFileSync('./config.json')).translate;

export default class Translator {
  static #subscribers = {};
  static #GTranslate = new v2.Translate({ key:apiKey });
  constructor(server) {
    this.server = server;
    this.subscribers = {};
  }

  static #subscribe(server, user, locale) {
    const listener = Translator.#subscribers[server] || (Translator.#subscribers[server] = new Translator(server));
    listener.getSubscriber(user) ? listener.changeLocale(user, locale) : listener.addSubscriber(user, locale);
    return listener;
  }

  static #messageDispatch(event) {
    
  }

  static async listLocales() {
    const [locales] = await Translator.#GTranslate.getLanguages();
    return locales;
  }

  static async toEnglish(text) {
    let translation;
    try { translation = await Translator.#GTranslate.translate(text, 'en'); } catch (error) {
      logLine('error', [`Translate error: ${error.message}`]);
    }
    // return this.tEmbed(text, translation);
    return translation;
  }

  getSubscriber(user) {
    return this.subscribers[user];
  }
}