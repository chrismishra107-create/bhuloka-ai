import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppUI } from './AppUI';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<AppUI />);
}