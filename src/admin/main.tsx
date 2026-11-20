import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminApp } from './AdminApp';
import {ThemeProvider} from '../context/ThemeContext';
import '../index.css';

ReactDOM.createRoot(document.getElementById('admin-root') as HTMLElement).render(
  <React.StrictMode><ThemeProvider><AdminApp /></ThemeProvider></React.StrictMode>
);
