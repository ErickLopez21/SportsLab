import { Link } from 'react-router-dom';

export default function Hero({ onSeeExample }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <div 
          className="absolute inset-x-0 bottom-0 h-full bg-no-repeat bg-bottom bg-cover opacity-10" 
          style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/landing/terrain.svg)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-transparent" />
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-sky-600" />
      </div>
      <div className="relative px-4 md:px-6 pt-10 pb-10 md:pt-16 md:pb-16">


        <div className="text-center max-w-3xl mx-auto">
          {/* Main Headline - Mobile Optimized */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-zinc-900 leading-[1.1]">
            Análisis deportivo
            <span className="block mt-2 text-sky-600">
              que gana apuestas
            </span>
          </h1>

          {/* Subheadline - Clear value prop */}
          <p className="mt-5 text-lg sm:text-xl md:text-2xl text-zinc-600 font-medium max-w-2xl mx-auto leading-relaxed">
            Ve el <span className="font-bold text-zinc-900">contexto completo</span> que otras plataformas ignoran. 
            Tendencias, rachas y splits que predicen resultados.
          </p>

          {/* Stats Bar - Cards profesionales (estilo app) */}
          <div className="mt-6 grid grid-cols-3 gap-3 max-w-lg mx-auto">
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900">85%</div>
              <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 uppercase tracking-wide font-semibold">Precisión</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900">1K+</div>
              <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 uppercase tracking-wide font-semibold">Props/semana</div>
            </div>
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-4">
              <div className="text-2xl sm:text-3xl font-extrabold text-zinc-900">NFL</div>
              <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 uppercase tracking-wide font-semibold">Disponible ahora</div>
            </div>
          </div>

          {/* CTAs - Animaciones sutiles */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
            <Link
              to="/auth?mode=signup"
              className="group w-full sm:w-auto px-8 py-4 rounded-xl bg-sky-600 text-white font-bold text-lg shadow-md hover:bg-sky-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              <span className="inline-flex items-center gap-2">
                Suscríbete ahora
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </span>
            </Link>
            <button
              type="button"
              onClick={onSeeExample}
              className="w-full sm:w-auto px-8 py-4 rounded-xl border-2 border-zinc-300 bg-white text-zinc-900 font-semibold text-lg shadow-sm hover:bg-zinc-50 hover:border-zinc-400 transition-all duration-200"
            >
              Ver demo gratis
            </button>
          </div>

          {/* Trust signals - Tono sobrio */}
          <div className="mt-6 flex flex-wrap justify-center items-center gap-3 text-zinc-500 text-sm">
            <div className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Cancela cuando quieras</span>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Datos oficiales</span>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Actualización diaria</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


