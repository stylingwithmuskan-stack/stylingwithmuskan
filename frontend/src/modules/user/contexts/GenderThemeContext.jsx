import React, { createContext, useContext, useState, useEffect } from "react";
const GenderThemeContext = createContext({
    gender: "women",
    setGender: () => { },
    hasSelected: false,
    darkMode: false,
    toggleDarkMode: () => { },
});
export const useGenderTheme = () => useContext(GenderThemeContext);
export const GenderThemeProvider = ({ children }) => {
    const [gender, setGenderState] = useState(() => {
        const saved = localStorage.getItem("muskan-gender");
        return saved || "women";
    });
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem("muskan-dark-mode") === "true";
    });

    const [hasSelected, setHasSelected] = useState(() => !!localStorage.getItem("muskan-gender"));
    const setGender = (g) => {
        setGenderState(g);
        setHasSelected(true);
        localStorage.setItem("muskan-gender", g);
    };

    const toggleDarkMode = () => {
        setDarkMode(prev => {
            const newValue = !prev;
            localStorage.setItem("muskan-dark-mode", newValue);
            return newValue;
        });
    };
    useEffect(() => {
        document.documentElement.classList.remove("theme-women", "theme-men");
        document.documentElement.classList.add(`theme-${gender}`);
    }, [gender]);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }, [darkMode]);

    return (
        <GenderThemeContext.Provider value={{ gender, setGender, hasSelected, darkMode, toggleDarkMode }}>
            {children}
        </GenderThemeContext.Provider>
    );
};
