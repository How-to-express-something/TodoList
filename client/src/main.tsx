import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { WhiteNoiseProvider } from './contexts/WhiteNoiseContext';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WhiteNoiseProvider>
        <App />
      </WhiteNoiseProvider>
    </BrowserRouter>
  </React.StrictMode>
);
