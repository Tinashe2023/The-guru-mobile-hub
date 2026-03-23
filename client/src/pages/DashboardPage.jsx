import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { shopAPI, announcementAPI, serviceAPI } from '../services/api';

const DashboardPage = () => {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [shopStatus, setShopStatus] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [services, setServices] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('shop:status_updated', (status) => setShopStatus(status));
    socket.on('announcement:new', (ann) => setAnnouncements(prev => [ann, ...prev]));
    socket.on('announcement:updated', (updatedAnn) => {
      setAnnouncements(prev => prev.map(ann => ann.id === updatedAnn.id ? updatedAnn : ann));
    });
    socket.on('announcement:deleted', (deletedId) => {
      setAnnouncements(prev => prev.filter(ann => ann.id !== deletedId));
    });
    return () => {
      socket.off('shop:status_updated');
      socket.off('announcement:new');
      socket.off('announcement:updated');
      socket.off('announcement:deleted');
    };
  }, [socket]);

  const loadData = async () => {
    try {
      const [statusData, annData, serviceData] = await Promise.all([
        shopAPI.getStatus(),
        announcementAPI.getAll(),
        serviceAPI.getAll(),
      ]);
      setShopStatus(statusData);
      setAnnouncements(annData.announcements || []);
      setServices(serviceData || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  };

  const handleToggle = async (field, value) => {
    try {
      const updated = await shopAPI.updateStatus({ [field]: value });
      setShopStatus(updated);
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const handlePostAnnouncement = async () => {
    if (!newAnnouncement.trim()) return;
    try {
      await announcementAPI.create({ content: newAnnouncement, type: 'general' });
      setNewAnnouncement('');
      setShowAnnouncementForm(false);
    } catch (err) {
      console.error('Announcement error:', err);
    }
  };

  const getBankingLabel = (status) => {
    const labels = {
      available: t('dashboard.bankingAvailable'),
      app_down: t('dashboard.bankingAppDown'),
      network_issues: t('dashboard.bankingNetworkIssue'),
      unavailable: t('dashboard.bankingUnavailable'),
    };
    return labels[status] || status;
  };

  const getBankingIcon = (status) => {
    if (status === 'available') return 'contactless';
    return 'cloud_off';
  };

  const formatPrice = (price, unit) => {
    if (!price) return '';
    const unitLabels = { per_page: '/page', per_service: '', per_set: '/set', per_transaction: '/txn', starting_from: ' onwards', varies: '' };
    return `₹${price}${unitLabels[unit] || ''}`;
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} mins ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hours ago`;
    return `${Math.floor(hrs / 24)} days ago`;
  };

  const serviceIcons = {
    recharge: 'sim_card', sim: 'assignment_ind', printing: 'print',
    photo: 'photo_camera', money_transfer: 'payments', repair: 'build', other: 'category',
  };

  return (
    <div className="page">
      {/* Admin Controls */}
      {isAdmin && shopStatus && (
        <div className="admin-controls animate-fade-in">
          <div className="admin-badge">
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>shield</span>
            Admin Controls
          </div>

          <div className="toggle-row">
            <div className="toggle-info">
              <span className="toggle-label">Shop Open/Closed</span>
              <span className="toggle-desc">Toggle the shop's operating status</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={shopStatus.is_open} onChange={(e) => handleToggle('is_open', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="toggle-row">
            <div className="toggle-info">
              <span className="toggle-label">Airtel Recharge</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={shopStatus.recharge_airtel} onChange={(e) => handleToggle('recharge_airtel', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="toggle-row">
            <div className="toggle-info">
              <span className="toggle-label">VI Recharge</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={shopStatus.recharge_vi} onChange={(e) => handleToggle('recharge_vi', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="toggle-row">
            <div className="toggle-info">
              <span className="toggle-label">Jio Recharge</span>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={shopStatus.recharge_jio} onChange={(e) => handleToggle('recharge_jio', e.target.checked)} />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="toggle-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
            <span className="toggle-label">Banking Status</span>
            <select
              className="select"
              value={shopStatus.banking_status}
              onChange={(e) => handleToggle('banking_status', e.target.value)}
            >
              <option value="available">Available</option>
              <option value="app_down">App Down</option>
              <option value="network_issues">Network Issues</option>
              <option value="unavailable">Unavailable</option>
            </select>
          </div>

          <div className="toggle-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
            <span className="toggle-label">Printing Status</span>
            <select
              className="select"
              value={shopStatus.printing_status}
              onChange={(e) => handleToggle('printing_status', e.target.value)}
            >
              <option value="available">Available</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Left Column */}
        <div>
          {/* Hero Status Card */}
          {shopStatus && (
            <div className="hero-card animate-slide-up" style={{ marginBottom: '1.5rem' }}>
              <div className="hero-live-badge">
                <div className={`hero-live-dot ${!shopStatus.is_open ? '' : ''}`} style={{ background: shopStatus.is_open ? 'var(--tertiary-fixed-dim)' : 'var(--error)' }}></div>
                <span className="hero-live-text">{t('dashboard.liveStatus')} • Lawgate</span>
              </div>

              <h1 className="hero-title">
                {shopStatus.is_open
                  ? t('dashboard.openUntil', { time: '9:30 PM' })
                  : t('dashboard.opensAt', { time: '11:00 AM' })}
              </h1>
              <p className="hero-subtitle">{t('dashboard.supportDesc')}</p>

              <div className="status-grid">
                <div className={`status-mini-card ${shopStatus.banking_status !== 'available' ? 'error' : ''}`}>
                  <span className="material-symbols-outlined">{getBankingIcon(shopStatus.banking_status)}</span>
                  <div>
                    <div className="status-mini-label">Banking</div>
                    <div className="status-mini-value">{getBankingLabel(shopStatus.banking_status)}</div>
                  </div>
                </div>

                <div className={`status-mini-card ${shopStatus.printing_status !== 'available' ? 'error' : ''}`}>
                  <span className="material-symbols-outlined">
                    {shopStatus.printing_status === 'available' ? 'print' : 'print_disabled'}
                  </span>
                  <div>
                    <div className="status-mini-label">Printing</div>
                    <div className="status-mini-value">
                      {shopStatus.printing_status === 'available' ? t('dashboard.printingAvailable') :
                       shopStatus.printing_status === 'busy' ? t('dashboard.printingBusy') : t('dashboard.printingOffline')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recharge Status */}
          {shopStatus && (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              {[
                { name: 'Airtel', ok: shopStatus.recharge_airtel },
                { name: 'VI', ok: shopStatus.recharge_vi },
                { name: 'Jio', ok: shopStatus.recharge_jio },
              ].map(p => (
                <div key={p.name} className={`badge ${p.ok ? 'badge-success' : 'badge-error'}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                    {p.ok ? 'check_circle' : 'cancel'}
                  </span>
                  {p.name} {p.ok ? t('dashboard.rechargeAvailable') : t('dashboard.rechargeUnavailable')}
                </div>
              ))}
            </div>
          )}

          {/* Essential Services */}
          <div className="section-header">
            <h2 className="section-title">{t('dashboard.essentialServices')}</h2>
            <span className="badge badge-primary">{t('dashboard.quickAccess')}</span>
          </div>

          <div className="services-grid" style={{ marginBottom: '1.5rem' }}>
            {services.slice(0, 6).map((service) => (
              <div key={service.id} className="service-card">
                <div className="service-icon-wrap">
                  <span className="material-symbols-outlined">{service.icon || serviceIcons[service.category] || 'category'}</span>
                </div>
                <h4>{service.name}</h4>
                {service.price && <div className="service-price">{formatPrice(service.price, service.price_unit)}</div>}
              </div>
            ))}
          </div>

          {/* Support Card */}
          {!isAdmin && (
            <div className="support-card" style={{ marginBottom: '1.5rem' }}>
              <div className="support-icon">
                <span className="material-symbols-outlined">chat_bubble</span>
              </div>
              <h3>{t('dashboard.directSupport')}</h3>
              <p>{t('dashboard.supportDesc')}</p>
              <button className="btn btn-secondary btn-lg" onClick={() => navigate('/chat')}>
                {t('dashboard.privateMessage')}
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Column — Guru Feed */}
        <div>
          <div className="feed-panel animate-fade-in">
            <div className="feed-header">
              <div className="feed-header-left">
                <div className="feed-header-icon">
                  <span className="material-symbols-outlined" style={{ color: 'white' }}>rss_feed</span>
                </div>
                <h3>{t('nav.feed')}</h3>
              </div>
              <span className="badge badge-warning">Broadcast</span>
            </div>

            {/* Admin: Post Announcement */}
            {isAdmin && (
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--surface-container-high)' }}>
                {showAnnouncementForm ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <textarea
                      className="input textarea"
                      placeholder="Write an announcement..."
                      value={newAnnouncement}
                      onChange={(e) => setNewAnnouncement(e.target.value)}
                      rows={3}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={handlePostAnnouncement}>Post</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setShowAnnouncementForm(false)}>{t('common.cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <button className="btn btn-primary btn-sm btn-full" onClick={() => setShowAnnouncementForm(true)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                    New Announcement
                  </button>
                )}
              </div>
            )}

            <div className="feed-list">
              {announcements.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <span className="material-symbols-outlined">campaign</span>
                  <p>No announcements yet</p>
                </div>
              ) : (
                announcements.map((ann) => (
                  <div key={ann.id} className={`feed-item ${ann.type === 'urgent' ? 'urgent' : ''}`}>
                    <div className="feed-item-header">
                      <div className={`feed-avatar ${ann.author_name?.toLowerCase().includes('guru') ? 'guru' : 'himanshi'}`}>
                        {ann.author_avatar ? (
                          <img src={ann.author_avatar} alt={ann.author_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                          ann.author_name?.[0]?.toUpperCase() || 'G'
                        )}
                      </div>
                      <span className="feed-author">{ann.author_name || 'Guru Hub'}</span>
                      <span className="feed-time">{timeAgo(ann.created_at)}</span>
                      {isAdmin && (
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                          <button 
                            className="btn-icon" 
                            style={{ width: '24px', height: '24px' }}
                            title="Edit"
                            onClick={() => {
                              const newContent = window.prompt("Edit announcement:", ann.content);
                              if (newContent !== null && newContent.trim() !== "") {
                                announcementAPI.update(ann.id, { content: newContent })
                                  .then(updatedAnn => {
                                    setAnnouncements(prev => prev.map(a => a.id === updatedAnn.id ? updatedAnn : a));
                                  })
                                  .catch(err => console.error("Edit error:", err));
                              }
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                          </button>
                          <button 
                            className="btn-icon" 
                            style={{ width: '24px', height: '24px', color: 'var(--error)' }}
                            title="Delete"
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this announcement?")) {
                                announcementAPI.delete(ann.id)
                                  .then(() => {
                                    setAnnouncements(prev => prev.filter(a => a.id !== ann.id));
                                  })
                                  .catch(err => console.error("Delete error:", err));
                              }
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="feed-content">{ann.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
