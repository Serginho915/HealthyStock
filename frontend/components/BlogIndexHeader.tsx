export function BlogIndexHeader() {
  return (
    <section className="blog-index-hero">
      <div className="container blog-index-hero-inner">
        <div>
          <p className="hero-kicker">HEALTH ASSET RESEARCH</p>
          <h1>Blog reports</h1>
          <p>
            Evidence-first articles on nutrients, foods, product choices, and long-term health returns.
          </p>
        </div>
        <aside className="blog-index-panel" aria-label="Blog coverage summary">
          <span>Coverage</span>
          <strong>Nutrients, comparisons, rankings</strong>
          <p>Search the archive by topic, ingredient, risk factor, or health outcome.</p>
        </aside>
      </div>
    </section>
  );
}
