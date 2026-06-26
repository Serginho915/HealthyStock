import { HealthIndex } from "../lib/types";

interface HeroProps {
  healthIndex: HealthIndex;
}

const trendLabels: Record<HealthIndex["metrics"][number]["trend"], string> = {
  up: "+",
  down: "-",
  steady: "="
};

export function Hero({ healthIndex }: HeroProps) {
  return (
    <section className="hero" aria-label="HealthyStock intro">
      <div className="hero-glow" aria-hidden="true" />
      <div className="container hero-grid">
        <div className="hero-copy">
          <p className="hero-kicker">HEALTH INTELLIGENCE TERMINAL</p>
          <h1>
            Your body is a market.
            <br />
            Invest like it matters.
          </h1>
          <p>
            Maria Iordanova decodes food, nutrients, and products like financial assets: expected return,
            hidden liabilities, and long-term health compounding.
          </p>
          <div className="hero-actions">
            <a href="#blog-feed" className="btn btn-primary">
              Open Today&apos;s Ratings
            </a>
            <a href="#newsletter" className="btn btn-ghost">
              Join Market Alerts
            </a>
          </div>
        </div>

        <aside className="hero-card" aria-label="Health portfolio dashboard">
          <h2>Research Health Index</h2>
          <ul>
            {healthIndex.metrics.map((metric) => (
              <li key={metric.label}>
                <span>{metric.label}</span>
                <strong>
                  <em>{trendLabels[metric.trend]}</em> {metric.value} / 100
                </strong>
              </li>
            ))}
          </ul>
          <p>{healthIndex.signal}</p>
          <small>Calculated from {healthIndex.sourcePostCount} latest reports.</small>
        </aside>
      </div>
      <div className="ticker" aria-label="market-style health ticker">
        <div className="ticker-track">
          {[...healthIndex.tickerItems, ...healthIndex.tickerItems].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
