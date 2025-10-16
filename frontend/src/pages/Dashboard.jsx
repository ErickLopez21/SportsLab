import { FiltersProvider } from '../context/FiltersContext';
import FilterBar from '../components/filters/FilterBar';
import ScheduleCard from '../components/cards/ScheduleCard';
import PlayerVsTeamCard from '../components/cards/PlayerVsTeamCard';
import TeamVsTeamCard from '../components/cards/TeamVsTeamCard';
import HeadshotsDemo from '../components/cards/HeadshotsDemo';
import HeadshotResolver from '../components/cards/HeadshotResolver';

export default function Dashboard() {
  return (
    <div className="min-h-app bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-5 py-6">
        <FiltersProvider>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Explorar (Dev)</h1>
            <a href="/" className="text-sm text-slate-400 hover:text-slate-200">← Volver</a>
          </div>
          <FilterBar />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            <ScheduleCard />
            <PlayerVsTeamCard />
            <TeamVsTeamCard />
            <HeadshotsDemo />
            <HeadshotResolver />
            {/* TODO: TrendsLast10Card, StandingsCard, PlayerProfileCard */}
          </div>
        </FiltersProvider>
      </div>
    </div>
  );
}


