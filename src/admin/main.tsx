import React from 'react';
import ReactDOM from 'react-dom/client';
import { AdminApp } from './AdminApp';
import '../index.css';
import { applySiteFavicon } from '../lib/siteFavicon';

void applySiteFavicon();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>
);
