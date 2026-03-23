import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { serviceAPI } from '../services/api';

const ServicesPage = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  const [services, setServices] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [editingService, setEditingService] = useState(null);
  const [editPrice, setEditPrice] = useState('');

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      const data = await serviceAPI.getAll();
      setServices(data);
    } catch (err) {
      console.error('Load services error:', err);
    }
  };

  const handleUpdateService = async () => {
    if (!editingService) return;
    try {
      await serviceAPI.update(editingService.id, {
        price: editPrice ? parseFloat(editPrice) : editingService.price,
        is_available: editingService.is_available,
      });
      setEditingService(null);
      loadServices();
    } catch (err) {
      console.error('Update error:', err);
    }
  };

  const categories = ['all', ...new Set(services.map(s => s.category).filter(Boolean))];

  const filtered = activeCategory === 'all' ? services : services.filter(s => s.category === activeCategory);

  const categoryIcons = {
    recharge: 'sim_card',
    sim: 'assignment_ind',
    printing: 'print',
    photo: 'photo_camera',
    money_transfer: 'payments',
    repair: 'build',
    other: 'category',
  };

  const categoryLabels = {
    recharge: t('services.catRecharge'),
    sim: t('services.catSim'),
    printing: t('services.catPrinting'),
    photo: t('services.catPhoto'),
    money_transfer: t('services.catTransfer'),
    repair: t('services.catRepair'),
    other: t('services.catOther'),
    all: t('services.catAll'),
  };

  const formatPrice = (price, unit) => {
    if (!price) return t('services.priceVaries');
    const unitLabels = {
      per_page: '/page',
      per_service: '',
      per_set: '/set',
      per_transaction: '/txn',
      starting_from: ' onwards',
      varies: '',
    };
    return `₹${price}${unitLabels[unit] || ''}`;
  };

  return (
    <div className="page">
      <div className="section-header">
        <h2 className="section-title">{t('services.title')}</h2>
        <span className="badge badge-primary">{filtered.length} {t('services.servicesCount')}</span>
      </div>

      {/* Category Chips */}
      <div className="category-chips">
        {categories.map(cat => (
          <button
            key={cat}
            className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {cat === 'all' ? 'grid_view' : categoryIcons[cat] || 'category'}
            </span>
            {categoryLabels[cat] || cat}
          </button>
        ))}
      </div>

      {/* Edit Modal */}
      {editingService && (
        <div className="modal-overlay" onClick={() => setEditingService(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{t('common.edit')}: {editingService.name}</h3>
            <div className="input-group">
              <label className="input-label">{t('common.price')} (₹)</label>
              <input
                className="input"
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder={String(editingService.price || '')}
              />
            </div>
            <div className="toggle-row" style={{ marginTop: '1rem' }}>
              <span className="toggle-label">{t('services.available')}</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={editingService.is_available}
                  onChange={(e) => setEditingService({ ...editingService, is_available: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-primary btn-full" onClick={handleUpdateService}>{t('common.save')}</button>
              <button className="btn btn-outline" onClick={() => setEditingService(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Services Grid */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">storefront</span>
          <h3>{t('common.noResults')}</h3>
          <p>No services found in this category.</p>
        </div>
      ) : (
        <div className="services-page-grid">
          {filtered.map((service) => (
            <div
              key={service.id}
              className={`service-page-card ${!service.is_available ? 'unavailable' : ''}`}
              onClick={() => {
                if (isAdmin) {
                  setEditingService(service);
                  setEditPrice(String(service.price || ''));
                }
              }}
            >
              <div className="service-page-icon">
                <span className="material-symbols-outlined">
                  {service.icon || categoryIcons[service.category] || 'category'}
                </span>
              </div>
              <div className="service-page-body">
                <h3 className="service-page-name">{service.name}</h3>
                {service.description && (
                  <p className="service-page-desc">{service.description}</p>
                )}
                <div className="service-page-footer">
                  <span className="service-page-price">{formatPrice(service.price, service.price_unit)}</span>
                  <span className={`badge ${service.is_available ? 'badge-success' : 'badge-error'}`}>
                    {service.is_available ? t('services.available') : t('services.unavailable')}
                  </span>
                </div>
              </div>
              {isAdmin && (
                <div className="service-page-edit-hint">
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServicesPage;
