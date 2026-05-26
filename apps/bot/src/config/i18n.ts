import i18next from 'i18next';
import FSBackend from 'i18next-fs-backend';
import path from 'path';

const localesPath = path.join(process.cwd(), 'locales');

i18next.use(FSBackend).init({
  lng: 'ru',
  fallbackLng: 'ru',
  ns: ['translation'],
  defaultNS: 'translation',
  backend: {
    loadPath: path.join(localesPath, '{{lng}}/{{ns}}.json'),
  },
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
