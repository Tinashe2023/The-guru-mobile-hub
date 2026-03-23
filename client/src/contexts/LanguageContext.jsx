import { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageContext = createContext(null);

export const useLanguage = () => useContext(LanguageContext);

const languages = [
  { code: 'en', name: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
];

export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();

  const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
  };

  return (
    <LanguageContext.Provider value={{ currentLanguage, languages, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
