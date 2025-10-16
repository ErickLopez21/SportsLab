import { Link } from 'react-router-dom';

export default function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-32 h-32 bg-sky-600 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-sky-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-36 h-36 bg-sky-400 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative px-4 md:px-6 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Urgency Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-100 border border-zinc-200 mb-6">
            <span className="text-zinc-700 text-sm font-semibold">
              Lanzamiento oficial
            </span>
          </div>

          {/* Main Headline */}
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-zinc-900 leading-tight mb-4">
            No pierdas otra apuesta
            <span className="block mt-2 text-sky-600">
              por falta de información
            </span>
          </h2>

          {/* Supporting Text */}
          <p className="mt-4 text-lg sm:text-xl text-zinc-600 max-w-2xl mx-auto leading-relaxed">
            Toma decisiones inteligentes basadas en datos reales y contexto situacional. 
            Toda la NFL en una sola plataforma.
          </p>

          {/* Stats Row - Cards profesionales */}
          <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 sm:p-6">
              <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-zinc-900 mb-1">32</div>
              <div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wide font-semibold">Equipos NFL</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 sm:p-6">
              <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-zinc-900 mb-1">500+</div>
              <div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wide font-semibold">Jugadores</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4 sm:p-6">
              <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-zinc-900 mb-1">1,000+</div>
              <div className="text-[10px] sm:text-xs text-zinc-500 uppercase tracking-wide font-semibold">Insights</div>
            </div>
          </div>

          {/* CTA Buttons - Mobile First */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center">
            <Link
              to="/auth?mode=signup"
              className="group relative overflow-hidden px-8 py-5 rounded-xl bg-sky-600 text-white font-bold text-lg shadow-md hover:bg-sky-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Empieza ahora por $150/mes
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>
            <button
              onClick={() => {
                const el = document.getElementById('live-demo');
                if (el) {
                  const headerOffset = 80;
                  const elementPosition = el.getBoundingClientRect().top;
                  const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                  window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                }
              }}
              className="px-8 py-5 rounded-xl bg-white border-2 border-zinc-300 text-zinc-900 font-semibold text-lg hover:bg-zinc-50 hover:border-zinc-400 transition-all duration-200"
            >
              Ver demo primero
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}

