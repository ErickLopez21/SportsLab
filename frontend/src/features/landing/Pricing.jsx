export default function Pricing() {
  return (
    <section id="pricing" className="bg-gradient-to-b from-white to-zinc-50">
      <div className="px-4 md:px-6 py-10 md:py-16">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-zinc-900">
              Un precio. Todo incluido.
            </h2>
            <p className="mt-3 text-lg sm:text-xl text-zinc-600">
              Sin trucos, sin niveles escondidos. Acceso completo a todo.
            </p>
          </div>

          {/* Main Pricing Card - Mobile First */}
          <div className="relative">
            {/* Popular Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
              <div className="px-4 py-1.5 rounded-full bg-zinc-900 text-white text-sm font-bold shadow-sm">
                Plan completo
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl bg-white border-2 border-zinc-300 shadow-lg">
              {/* Gradient Background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-sky-50 rounded-full blur-3xl" />
              
              <div className="relative p-6 sm:p-8 md:p-10">
                {/* Plan Name */}
                <div className="text-center mb-6">
                  <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 mb-2">
                    SportsLab Premium
                  </h3>
                  <p className="text-zinc-600 text-sm sm:text-base">
                    Análisis completo de la NFL
                  </p>
                </div>

                {/* Price - Mobile Optimized */}
                <div className="text-center mb-8">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl sm:text-3xl font-bold text-zinc-600">$</span>
                    <span className="text-6xl sm:text-7xl font-black text-zinc-900">
                      150
                    </span>
                    <span className="text-xl sm:text-2xl font-semibold text-zinc-500">
                      MXN
                    </span>
                  </div>
                  <div className="mt-1 text-zinc-500 text-sm sm:text-base">
                    por mes
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200">
                    <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-700">
                      Cancela cuando quieras
                    </span>
                  </div>
                </div>

                {/* Features List - Grid con Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  <FeatureCard text="Acceso completo a NFL" />
                  <FeatureCard text="Tendencias y rachas detalladas" />
                  <FeatureCard text="Splits situacionales completos" />
                  <FeatureCard text="Comparación H2H histórico" />
                  <FeatureCard text="Rankings y percentiles" />
                  <FeatureCard text="Filtros avanzados ilimitados" />
                  <FeatureCard text="Datos actualizados diariamente" />
                  <FeatureCard text="Soporte prioritario" />
                </div>

                {/* CTA Button - Full Width on Mobile */}
                <button
                  onClick={() => {
                    // TODO: Implementar signup/checkout
                    alert('Próximamente: proceso de pago');
                  }}
                  className="w-full py-4 sm:py-5 rounded-xl bg-sky-600 text-white font-bold text-lg sm:text-xl shadow-md hover:bg-sky-700 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  Suscribirse ahora →
                </button>

                {/* Trust Signals */}
                <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-3 text-xs sm:text-sm text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span>Pago seguro</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    <span>Sin letra chica</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Satisfacción garantizada</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Value Proposition */}
          <div className="mt-10 p-6 rounded-2xl bg-zinc-50 border border-zinc-200">
            <div className="text-center">
              <p className="text-zinc-700 text-sm sm:text-base leading-relaxed">
                <span className="font-bold text-zinc-900">$150 MXN</span> es menos que una apuesta perdida. 
                Con SportsLab, tomas decisiones informadas que pueden pagarse en una sola jugada. 
                <span className="font-semibold text-zinc-900"> Es inversión, no gasto.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ text }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-200">
      <svg className="w-5 h-5 text-zinc-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      <span className="text-zinc-900 text-sm sm:text-base font-medium leading-snug">{text}</span>
    </div>
  );
}

