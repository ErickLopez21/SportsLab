import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import MainTab from './pages/MainTab';
import TeamPage from './pages/TeamPage';
import MatchupPage from './pages/MatchupPage';
import PlayersPage from './pages/PlayersPage';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/explore" element={<Dashboard />} />
        <Route path="/app" element={<MainTab />} />
        <Route path="/teams/:team" element={<TeamPage />} />
        <Route path="/matchup/:home/:away" element={<MatchupPage />} />
        <Route path="/versus/:home/vs/:away" element={<MatchupPage />} />
        <Route path="/versus/vs/:away" element={<MatchupPage />} />
        <Route path="/versus/:home" element={<MatchupPage />} />
        <Route path="/versus" element={<MatchupPage />} />
        <Route path="/players" element={<PlayersPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
