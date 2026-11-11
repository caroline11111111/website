import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import {AuthProvider} from './context/AuthContext';
import {CartProvider} from './context/CartContext';
import {LanguageProvider} from './context/LanguageContext';
import {ThemeProvider} from './context/ThemeContext';
import './index.css';
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
 <React.StrictMode><AuthProvider><LanguageProvider><ThemeProvider><CartProvider><App/></CartProvider></ThemeProvider></LanguageProvider></AuthProvider></React.StrictMode>
);
