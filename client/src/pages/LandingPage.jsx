import { Link } from 'react-router-dom';

const LandingPage = () => {
  const features = [
    {
      icon: 'print',
      title: 'Printing & Scanning',
      desc: 'High-quality prints, photocopies, scans, and lamination — all at competitive prices.',
    },
    {
      icon: 'account_balance',
      title: 'Banking Services',
      desc: 'Cash deposits, withdrawals, money transfers, and mobile banking assistance.',
    },
    {
      icon: 'support_agent',
      title: 'Concierge Support',
      desc: 'SIM activations, recharges, document help, and personalized customer care.',
    },
  ];

  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="landing-nav">
        <span className="landing-logo">The Guru Mobile Hub</span>
        <Link to="/login" className="btn btn-outline landing-login-btn" id="landing-login">
          Login
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-content animate-slide-up">
          <div className="landing-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
              storefront
            </span>
            Open Daily • Lawgate, Phagwara
          </div>
          <h1 className="landing-title">
            Your Neighbourhood
            <br />
            <span className="landing-title-accent">Digital Hub</span>
          </h1>
          <p className="landing-subtitle">
            Printing, banking, recharges, and concierge support — all under one roof.
            Experience seamless service with real-time status updates and direct chat.
          </p>
          <div className="landing-cta-group">
            <Link to="/register" className="btn btn-secondary btn-lg" id="landing-get-started">
              Get Started
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                arrow_forward
              </span>
            </Link>
            <Link to="/login" className="btn btn-outline btn-lg" id="landing-sign-in">
              Sign In
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="landing-stats animate-fade-in">
          {[
            { value: '500+', label: 'Happy Customers' },
            { value: '24/7', label: 'Chat Support' },
            { value: '10+', label: 'Services' },
          ].map((stat) => (
            <div key={stat.label} className="landing-stat">
              <span className="landing-stat-value">{stat.value}</span>
              <span className="landing-stat-label">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Grid */}
      <section className="landing-features animate-fade-in">
        <h2 className="landing-section-title">Everything You Need</h2>
        <div className="landing-features-grid">
          {features.map((f) => (
            <div key={f.title} className="card-elevated landing-feature-card">
              <div className="landing-feature-icon">
                <span className="material-symbols-outlined">{f.icon}</span>
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="landing-footer-cta animate-fade-in">
        <h2>Ready to get started?</h2>
        <p>Create your free account and access all services instantly.</p>
        <Link to="/register" className="btn btn-primary btn-lg">
          Create Free Account
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
            person_add
          </span>
        </Link>
      </section>

      <footer className="landing-footer">
        <p>© 2026 The Guru Mobile Hub — Lawgate, Phagwara</p>
      </footer>
    </div>
  );
};

export default LandingPage;
