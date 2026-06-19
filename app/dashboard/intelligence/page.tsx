'use client';

import ModuleHub from '@/components/ModuleHub';
import HubCard from '@/components/HubCard';
import { 
  Activity, 
  Brain, 
  TrendingUp, 
  FlaskConical, 
  Target, 
  Users 
} from 'lucide-react';

export default function IntelligenceHub() {
  return (
    <ModuleHub
      title="Intelligence"
      description="Advanced AI-powered insights, predictive forecasting, simulation, custom scorecards, and leadership development tools."
      backHref="/dashboard"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        <HubCard
          title="Pulse Dashboard"
          description="Real-time operational, financial, and impact pulse across the business."
          href="/dashboard/intelligence/pulse-dashboard"
          icon={Activity}
        />

        <HubCard
          title="Neural Insights"
          description="AI-driven insights and pattern recognition across operations and impact data."
          href="/dashboard/intelligence/neural-insights"
          icon={Brain}
        />

        <HubCard
          title="Predictive Forecasts"
          description="Demand forecasting, revenue projections, and scenario-based predictions."
          href="/dashboard/intelligence/predictive-forecasts"
          icon={TrendingUp}
        />

        <HubCard
          title="Simulation Lab"
          description="Run what-if scenarios, stress tests, and strategic simulations."
          href="/dashboard/intelligence/simulation-lab"
          icon={FlaskConical}
        />

        <HubCard
          title="Custom Scorecards"
          description="Build and track custom KPIs, impact metrics, and performance scorecards."
          href="/dashboard/intelligence/custom-scorecards"
          icon={Target}
        />

        <HubCard
          title="Leadership Development"
          description="Super-Cube leadership tools, assessments, and development journeys."
          href="/dashboard/intelligence/leadership-development"
          icon={Users}
        />

      </div>
    </ModuleHub>
  );
}