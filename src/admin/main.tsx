import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminApp } from './AdminApp';
import { ThemeProvider } from '../context/ThemeContext';
import '../index.css';
import { applySiteFavicon } from '../lib/siteFavicon';

void applySiteFavicon('admin');

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider><AdminApp /></ThemeProvider>
  </React.StrictMode>
);
