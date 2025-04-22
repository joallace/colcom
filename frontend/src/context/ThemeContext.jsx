jsx
import React, { createContext, useState, useContext } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [themeColors, setThemeColors] = useState({
    bg: '#1F0D00',
    fontColor: '#d9d9d9',
    navbarBg: '#522B00',
    inputBg: '#4a2600',
    green: '#669100',
    orange: '#BC5200',
    red: '#be2400',
    yellow: '#cdcd00',
    blue: '#4da8c1',
  });

  const updateThemeColors = (newColors) => {
    setThemeColors((prevColors) => ({
      ...prevColors,
      ...newColors,
    }));
  };

  return (
    <ThemeContext.Provider value={{ themeColors, updateThemeColors }}>
      {children}
    </ThemeContext.Provider>
  );
};