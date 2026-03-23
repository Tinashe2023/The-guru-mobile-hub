import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { productAPI } from '../services/api';

const ProductsPage = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();

  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', category: 'smartwatch', price: '', original_price: '', image_url: '', stock_quantity: '',
  });
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    loadProducts();
  }, [activeCategory]);

  const loadProducts = async () => {
    try {
      const data = await productAPI.getAll(activeCategory || undefined);
      setProducts(data);
    } catch (err) {
      console.error('Load products error:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        original_price: form.original_price ? parseFloat(form.original_price) : null,
        stock_quantity: form.stock_quantity ? parseInt(form.stock_quantity) : 0,
      };
      if (editProduct) {
        await productAPI.update(editProduct.id, payload);
      } else {
        await productAPI.create(payload);
      }
      setShowForm(false);
      setEditProduct(null);
      setForm({ name: '', description: '', category: 'smartwatch', price: '', original_price: '', image_url: '', stock_quantity: '' });
      loadProducts();
    } catch (err) {
      console.error('Product save error:', err);
    }
  };

  const handleEdit = (product) => {
    setEditProduct(product);
    setForm({
      name: product.name || '',
      description: product.description || '',
      category: product.category || 'smartwatch',
      price: String(product.price || ''),
      original_price: product.original_price ? String(product.original_price) : '',
      image_url: product.image_url || '',
      stock_quantity: String(product.stock_quantity || ''),
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      await productAPI.delete(id);
      setConfirmDelete(null);
      loadProducts();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const categoryList = [
    { value: '', label: t('products.allCategories'), icon: 'grid_view' },
    { value: 'smartwatch', label: t('products.catSmartwatch'), icon: 'watch' },
    { value: 'earbuds', label: t('products.catEarbuds'), icon: 'headphones' },
    { value: 'speaker', label: t('products.catSpeaker'), icon: 'speaker' },
    { value: 'charger', label: t('products.catCharger'), icon: 'charging_station' },
    { value: 'phone', label: t('products.catPhone'), icon: 'smartphone' },
    { value: 'power_bank', label: t('products.catPowerBank'), icon: 'battery_charging_full' },
    { value: 'accessory', label: t('products.catAccessory'), icon: 'devices_other' },
  ];

  return (
    <div className="page">
      <div className="section-header">
        <h2 className="section-title">{t('products.title')}</h2>
        {isAdmin && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditProduct(null); setForm({ name: '', description: '', category: 'smartwatch', price: '', original_price: '', image_url: '', stock_quantity: '' }); setShowForm(true); }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            {t('products.addProduct')}
          </button>
        )}
      </div>

      {/* Category Chips */}
      <div className="category-chips">
        {categoryList.map(cat => (
          <button
            key={cat.value}
            className={`category-chip ${activeCategory === cat.value ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.value)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Add/Edit Product Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setEditProduct(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{editProduct ? t('products.editProduct') : t('products.addProduct')}</h3>
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label">{t('products.productName')}</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g., boAt Airdopes 131" />
              </div>
              <div className="input-group">
                <label className="input-label">{t('products.description')}</label>
                <textarea className="input textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Short description..." />
              </div>
              <div className="input-group">
                <label className="input-label">{t('products.category')}</label>
                <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {categoryList.filter(c => c.value).map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="input-group">
                  <label className="input-label">{t('common.price')} (₹)</label>
                  <input className="input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required placeholder="499" />
                </div>
                <div className="input-group">
                  <label className="input-label">{t('products.originalPrice')} (₹)</label>
                  <input className="input" type="number" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} placeholder="799" />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">{t('products.stock')}</label>
                <input className="input" type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} placeholder="10" />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-full" type="submit">{t('common.save')}</button>
                <button className="btn btn-outline" type="button" onClick={() => { setShowForm(false); setEditProduct(null); }}>{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{t('common.confirm')}</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--on-surface-variant)' }}>This product will be permanently deleted.</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-full" style={{ background: 'var(--error)' }} onClick={() => handleDelete(confirmDelete)}>
                {t('common.delete')}
              </button>
              <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">inventory_2</span>
          <h3>{t('common.noResults')}</h3>
          <p>No products found in this category.</p>
        </div>
      ) : (
        <div className="products-grid">
          {products.map((product) => (
            <div key={product.id} className="product-card">
              <div className="product-image">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} />
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: 'var(--outline-variant)' }}>
                    {categoryList.find(c => c.value === product.category)?.icon || 'devices_other'}
                  </span>
                )}
                {!product.is_available && (
                  <div className="product-sold-out">{t('products.soldOut')}</div>
                )}
                {product.original_price && product.price < product.original_price && (
                  <div className="product-discount">
                    -{Math.round(((product.original_price - product.price) / product.original_price) * 100)}%
                  </div>
                )}
              </div>
              <div className="product-body">
                <h4 className="product-name">{product.name}</h4>
                {product.description && <p className="product-desc">{product.description}</p>}
                <div className="product-price-row">
                  <span className="product-price">₹{product.price}</span>
                  {product.original_price && product.price < product.original_price && (
                    <span className="product-original-price">₹{product.original_price}</span>
                  )}
                </div>
                <div className="product-footer">
                  <span className={`badge ${product.is_available ? (product.stock_quantity > 0 ? 'badge-success' : 'badge-error') : 'badge-error'}`}>
                    {!product.is_available ? t('products.soldOut') : product.stock_quantity > 0 ? `${product.stock_quantity} ${t('products.inStock')}` : t('products.soldOut')}
                  </span>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleEdit(product); }} title={t('common.edit')}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                      </button>
                      <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setConfirmDelete(product.id); }} title={t('common.delete')}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--error)' }}>delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
