import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';
import { DebugOverlay } from './components/DebugOverlay';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <DebugOverlay />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:id" element={<Lobby />} />
        <Route path="/game/:id" element={<Game />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
