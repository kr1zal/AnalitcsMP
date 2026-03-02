/**
 * Landing page for unauthenticated users.
 * Modular composition of all landing sections.
 *
 * Rule #48: Root wrapper MUST have overflow-x-hidden.
 */
import { NavBar } from './components/NavBar';
import { HeroSection } from './components/HeroSection';
import { TrustMarquee } from './components/TrustMarquee';
import { ProductShowcase } from './components/ProductShowcase';
import { SocialProofSection } from './components/SocialProofSection';
import { StatsBar } from './components/StatsBar';
import { ProblemSection } from './components/ProblemSection';
import { FeaturesSection } from './components/FeaturesSection';
import { DataFlowSectionV4 } from './components/DataFlowSection';
import { HowItWorksSection } from './components/HowItWorksSection';
import { SecuritySection } from './components/SecuritySection';
import { PricingSection } from './components/PricingSection';
import { FAQSection } from './components/FAQSection';
import { FinalCTASection } from './components/FinalCTASection';
import { FooterSection } from './components/FooterSection';
import { SectionDivider } from './hooks/useLandingAnimations';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <NavBar />
      <HeroSection />
      <TrustMarquee />
      <ProductShowcase />
      <SocialProofSection />
      <SectionDivider />
      <StatsBar />
      <SectionDivider />
      <ProblemSection />
      <SectionDivider />
      <FeaturesSection />
      {/* DataFlow has dark bg - no divider needed */}
      <DataFlowSectionV4 />
      <HowItWorksSection />
      {/* SecuritySection has dark bg - no divider needed */}
      <SecuritySection />
      <SectionDivider />
      <PricingSection />
      <SectionDivider />
      <FAQSection />
      {/* FinalCTA has gradient bg - no divider needed */}
      <FinalCTASection />
      <FooterSection />
    </div>
  );
}
