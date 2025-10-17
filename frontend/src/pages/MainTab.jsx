import { Link, useLocation } from 'react-router-dom';
import LightHeader from '../components/common/LightHeader';
import ScoresCard from '../components/cards/ScoresCard';
import StandingsCard from '../components/cards/StandingsCard';
import { useState } from 'react';

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-zinc-200 ${className}`}>
      {children}
    </div>
  );
}

function NavCard() {
  const location = useLocation();
  const linkBase = 'text-zinc-700 hover:text-black px-3 py-2 rounded-lg hover:bg-zinc-100';
  const activeCls = 'bg-zinc-100 text-black';
  const isHome = location.pathname === '/app' && !location.hash;
  const isPlayers = location.pathname === '/players';
  const isTeams = location.pathname.startsWith('/versus');
  const isProfile = location.hash === '#profile';
  const icon = (base, active = false) => `/icons/${base}${active ? ' bold' : ''}.svg`;
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-1 text-sm">
        <Link className={`${linkBase} ${isHome ? activeCls : ''} flex items-center gap-2`} to="/app">
          <img src={icon('home', isHome)} alt="Inicio" className="w-4 h-4" />
          Inicio
        </Link>
        <Link className={`${linkBase} ${isPlayers ? activeCls : ''} flex items-center gap-2`} to="/players">
          <img src={icon('user', isPlayers)} alt="Jugadores" className="w-4 h-4" />
          Jugadores
        </Link>
        <Link className={`${linkBase} ${isTeams ? activeCls : ''} flex items-center gap-2`} to="/versus">
          <img src={icon('sword-spade', isTeams)} alt="Versus" className="w-4 h-4" />
          Versus
        </Link>
        <a className={`${linkBase} ${isProfile ? activeCls : ''} flex items-center gap-2`} href="#profile">
          <img src={icon('user', isProfile)} alt="Perfil" className="w-4 h-4" />
          Perfil
        </a>
      </div>
    </Card>
  );
}

export default function MainTab() {
  const [league, setLeague] = useState('NFL');
  const [season] = useState(new Date().getFullYear());
  return (
    <div className="font-sans min-h-app" style={{ backgroundColor: '#FAFAFA' }}>
      <LightHeader league={league} onLeagueChange={setLeague} />
      <div
        className="max-w-screen-2xl mx-auto px-2 md:px-4 lg:px-6"
        style={{ paddingTop: '1.5rem', paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {/* Left nav (hidden on mobile) */}
          <div className="hidden md:block md:col-span-2 lg:col-span-2 md:sticky md:top-4 self-start">
            <NavCard />
          </div>

          {/* Main content grid */}
          <div className="col-span-12 md:col-span-9 lg:col-span-10">
            {/* Header spacing removed to align with left nav */}
            {/* Quitamos DateStrip a petición, nos enfocamos en semanas */}
            <div className="grid grid-cols-12 gap-4 md:gap-6">
              <div className="col-span-12 md:col-span-7 lg:col-span-7"><ScoresCard season={season} league={league} initialWeek={1} /></div>
              <div className="col-span-12 md:col-span-5 lg:col-span-5"><StandingsCard season={season} league={league} /></div>
            </div>
          </div>
        </div>
      </div>
      {/* Mobile bottom sheet nav removed per redesign */}
    </div>
  );
}


