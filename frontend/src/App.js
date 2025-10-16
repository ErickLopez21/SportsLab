import './App.css';
import Header from './components/Header';
import Footer from './components/Footer';
import WeekSchedule from './components/home/WeekSchedule';

function App() {
  return (
    <div className="App bg-slate-200 min-h-app text-slate-900 font-sans">
      <Header />
      <main className="max-w-[1100px] mx-auto my-8 px-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex-1">
            <section className="bg-white rounded-2xl border border-slate-200 shadow-md p-6">
              <h2 className="m-0 mb-4 text-base font-semibold">Hoy</h2>
              <WeekSchedule start="2025-10-06" end="2025-10-12" season={2025} />
            </section>
          </div>
          <aside className="w-full lg:w-80">
            <section className="bg-white rounded-2xl border border-slate-200 shadow-md p-6">
              <h2 className="m-0 mb-4 text-base font-semibold">Tendencias rápidas</h2>
              <p className="text-slate-500 text-sm">Próximamente: streaks y alertas automáticas.</p>
            </section>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default App;