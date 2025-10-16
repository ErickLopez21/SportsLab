import Hero from '../features/landing/Hero';
import ProblemSolution from '../features/landing/ProblemSolution';
import LiveDemo from '../features/landing/LiveDemo';
import Pricing from '../features/landing/Pricing';
import FinalCTA from '../features/landing/FinalCTA';
import Footer from '../components/Footer';
import LightHeader from '../components/common/LightHeader';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-zinc-200 ${className}`}>
      {children}
    </div>
  );
}

function AnimatedSection({ children, delay = 0 }) {
  const [ref, isVisible] = useScrollAnimation();
  
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// Helper para scroll con offset (considera el header)
const scrollToSection = (sectionId) => {
  const el = document.getElementById(sectionId);
  if (el) {
    const headerOffset = 80; // Altura aproximada del header + padding
    const elementPosition = el.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }
};

export default function Landing() {
  return (
    <div className="font-sans min-h-app" style={{ backgroundColor: '#FAFAFA' }}>
      <LightHeader 
        hideLeagueSelector 
        hideMenuButton 
        showAuthButtons={true}
      />
      <main className="max-w-screen-2xl mx-auto px-2 md:px-4 lg:px-6" style={{ paddingTop: '1.5rem', paddingBottom: 'calc(3rem + env(safe-area-inset-bottom))' }}>
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {/* Hero Section - Sin animación porque es el primero */}
          <div className="col-span-12">
            <Card className="overflow-hidden">
              <Hero onSeeExample={() => scrollToSection('live-demo')} />
            </Card>
          </div>

          {/* Problem → Solution Section */}
          <div className="col-span-12">
            <AnimatedSection delay={100}>
              <Card className="overflow-hidden">
                <ProblemSolution />
              </Card>
            </AnimatedSection>
          </div>

          {/* Live Demo */}
          <div className="col-span-12">
            <AnimatedSection delay={200}>
              <Card>
                <LiveDemo />
              </Card>
            </AnimatedSection>
          </div>

          {/* Pricing Section */}
          <div className="col-span-12">
            <AnimatedSection delay={300}>
              <Card className="overflow-hidden">
                <Pricing />
              </Card>
            </AnimatedSection>
          </div>
        </div>
      </main>

      {/* Final CTA - Full Width, No Container */}
      <AnimatedSection delay={400}>
        <FinalCTA />
      </AnimatedSection>

      <Footer />
    </div>
  );
}



