export default function ProblemSolution() {
  return (
    <section className="bg-white">
      <div className="px-4 md:px-6 py-10 md:py-16">
        <div className="max-w-6xl mx-auto">
          
          {/* Section Header */}
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-900 mb-4">
              Análisis que sí marca la diferencia
            </h2>
            <p className="text-lg sm:text-xl text-zinc-600 max-w-3xl mx-auto">
              No más decisiones a ciegas. Ve exactamente qué esperar con datos completos.
            </p>
          </div>

          {/* Main Comparison - 2 columns */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            
            {/* Left - What you DON'T get elsewhere */}
            <div className="bg-white rounded-2xl border-2 border-zinc-200 shadow-md p-6 md:p-8 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-zinc-900">
                  Otras plataformas
                </h3>
              </div>

              <div className="space-y-3">
                <LimitationItem text="Solo promedios básicos de temporada" />
                <LimitationItem text="Sin contexto de rachas recientes" />
                <LimitationItem text="No muestran historial H2H" />
                <LimitationItem text="Ignoran factores situacionales" />
                <LimitationItem text="Sin rankings comparativos" />
                <LimitationItem text="Comparaciones limitadas o inexistentes" />
                <LimitationItem text="Sin análisis de tendencias Over/Under" />
                <LimitationItem text="Filtros básicos o ninguno" />
              </div>
            </div>

            {/* Right - What you GET with SportsLab */}
            <div className="bg-white rounded-2xl border-2 border-zinc-300 shadow-sm p-6 md:p-8 hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-zinc-900">
                  SportsLab
                </h3>
              </div>

              <div className="space-y-3">
                <BenefitItem text="Tendencias de últimos 3, 5, 10 juegos" />
                <BenefitItem text="Rachas calientes y frías al instante" />
                <BenefitItem text="Head-to-Head histórico completo" />
                <BenefitItem text="Splits: casa/visita, división" />
                <BenefitItem text="Rankings por liga y posición" />
                <BenefitItem text="Comparación lado a lado de equipos" />
                <BenefitItem text="Tendencias TT y patrones Over/Under" />
                <BenefitItem text="Filtros inteligentes (sede, temporada)" />
              </div>
            </div>
          </div>

          {/* CTA Card */}
          <div className="bg-zinc-50 rounded-2xl border border-zinc-200 shadow-sm p-6 md:p-8 text-center hover:bg-white transition-all duration-300">
            <h3 className="text-2xl md:text-3xl font-black text-zinc-900 mb-3">
              Todo en una sola plataforma
            </h3>
            <p className="text-zinc-600 text-base md:text-lg mb-6 max-w-2xl mx-auto">
              NFL con datos actualizados diariamente. Toda la información que necesitas en un solo lugar.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
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
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-sky-600 text-white font-bold shadow-md hover:bg-sky-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                Prueba la demo →
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('pricing');
                  if (el) {
                    const headerOffset = 80;
                    const elementPosition = el.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                  }
                }}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl border-2 border-zinc-300 bg-white text-zinc-900 font-semibold hover:border-zinc-400 hover:bg-zinc-50 transition-all duration-200"
              >
                Ver planes
              </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

function LimitationItem({ text }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 hover:bg-zinc-100 transition-colors duration-200">
      <div className="flex-shrink-0 mt-0.5">
        <svg className="w-5 h-5 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      </div>
      <span className="text-zinc-700 text-sm md:text-base leading-snug">{text}</span>
    </div>
  );
}

function BenefitItem({ text }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-sky-50 hover:bg-sky-100 transition-colors duration-200">
      <div className="flex-shrink-0 mt-0.5">
        <svg className="w-5 h-5 text-sky-600" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      </div>
      <span className="text-zinc-900 text-sm md:text-base font-medium leading-snug">{text}</span>
    </div>
  );
}
