import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {AuthProvider} from './context/AuthContext';
import {CartProvider} from './context/CartContext';
import {LanguageProvider} from './context/LanguageContext';
import {ThemeProvider} from './context/ThemeContext';
import {CurrencyProvider} from './context/CurrencyContext';
import './index.css';
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
 <React.StrictMode><AuthProvider><LanguageProvider><ThemeProvider><CurrencyProvider><CartProvider><App/></CartProvider></CurrencyProvider></ThemeProvider></LanguageProvider></AuthProvider></React.StrictMode>
);
