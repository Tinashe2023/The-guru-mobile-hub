import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { ticketAPI } from '../services/api';

const TicketsPage = () => {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const { socket } = useSocket();
  const [tickets, setTickets] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [form, setForm] = useState({ device_type: 'phone', device_brand: '', device_model: '', issue_description: '' });
  const [loading, setLoading] = useState(false);

  // Admin status update
  const [statusUpdate, setStatusUpdate] = useState({ status: '', note: '', assigned_to: '' });

  useEffect(() => { 
    loadTickets();
    if (isAdmin) loadAdmins();
  }, [isAdmin]);

  const loadAdmins = async () => {
    try {
      // Import userAPI dynamically or use existing. wait, I'll need to import userAPI.
      const userAPI = (await import('../services/api')).userAPI;
      const users = await userAPI.listUsers();
      setAdmins(users.filter(u => u.role === 'admin'));
    } catch(err) {
      console.error('Failed to load admins', err);
    }
  };

  useEffect(() => {
    if (!socket) return;
    socket.on('ticket:new', () => loadTickets());
    socket.on('ticket:updated', () => loadTickets());
    return () => { socket.off('ticket:new'); socket.off('ticket:updated'); };
  }, [socket]);

  const loadTickets = async () => {
    try {
      const data = await ticketAPI.getAll();
      setTickets(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await ticketAPI.create(form);
      setShowForm(false);
      setForm({ device_type: 'phone', device_brand: '', device_model: '', issue_description: '' });
      loadTickets();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedTicket || !statusUpdate.status) return;
    try {
      await ticketAPI.updateStatus(selectedTicket.id, statusUpdate);
      setSelectedTicket(null);
      setStatusUpdate({ status: '', note: '' });
      loadTickets();
    } catch (err) {
      console.error(err);
    }
  };

  const loadTicketDetail = async (ticket) => {
    try {
      const detail = await ticketAPI.getOne(ticket.id);
      setSelectedTicket(detail);
      setStatusUpdate({ status: detail.status, note: '', assigned_to: detail.assigned_to || '' });
    } catch (err) {
      console.error(err);
    }
  };

  const statusIcons = {
    received: 'inbox', diagnosing: 'search', waiting_parts: 'inventory_2',
    repairing: 'build', testing: 'fact_check', ready: 'redeem', completed: 'check_circle', cancelled: 'cancel',
  };

  const statusOrder = ['received', 'diagnosing', 'waiting_parts', 'repairing', 'testing', 'ready', 'completed'];

  const getProgress = (status) => {
    const idx = statusOrder.indexOf(status);
    return idx >= 0 ? Math.round(((idx + 1) / statusOrder.length) * 100) : 0;
  };

  return (
    <div className="page">
      <div className="section-header">
        <h2 className="section-title">{t('tickets.title')}</h2>
        {!isAdmin && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            {t('tickets.newTicket')}
          </button>
        )}
      </div>

      {/* New Ticket Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{t('tickets.newTicket')}</h3>
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label">{t('tickets.deviceType')}</label>
                <select className="select" value={form.device_type} onChange={(e) => setForm({ ...form, device_type: e.target.value })}>
                  <option value="phone">Phone</option>
                  <option value="laptop">Laptop</option>
                  <option value="tablet">Tablet</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">{t('tickets.deviceBrand')}</label>
                <input className="input" placeholder="e.g., Samsung, Dell, Apple" value={form.device_brand} onChange={(e) => setForm({ ...form, device_brand: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">{t('tickets.deviceModel')}</label>
                <input className="input" placeholder="e.g., Galaxy S23, XPS 15" value={form.device_model} onChange={(e) => setForm({ ...form, device_model: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">{t('tickets.issueDescription')}</label>
                <textarea className="input textarea" placeholder="Describe what's wrong with your device..." value={form.issue_description} onChange={(e) => setForm({ ...form, issue_description: e.target.value })} required rows={4} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                  {loading ? t('common.loading') : t('tickets.submitTicket')}
                </button>
                <button className="btn btn-outline" type="button" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="modal-title" style={{ margin: 0 }}>
                #{selectedTicket.ticket_number}
              </h3>
              <span className={`badge ${selectedTicket.status === 'ready' || selectedTicket.status === 'completed' ? 'badge-success' : 'badge-secondary'}`}>
                {t(`tickets.status.${selectedTicket.status}`)}
              </span>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontWeight: 700 }}>{selectedTicket.device_brand} {selectedTicket.device_model}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginTop: '0.5rem' }}>{selectedTicket.issue_description}</p>
              {selectedTicket.assignee_name && (
                <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>badge</span>
                  Assigned to: {selectedTicket.assignee_name}
                </p>
              )}
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Progress</span>
                <span className="badge badge-secondary">{getProgress(selectedTicket.status)}%</span>
              </div>
              <div style={{ background: 'var(--surface-container-high)', borderRadius: '4px', height: '6px' }}>
                <div style={{ background: 'var(--secondary-container)', borderRadius: '4px', height: '100%', width: `${getProgress(selectedTicket.status)}%`, transition: 'width 0.5s ease' }} />
              </div>
            </div>

            {/* Updates Timeline */}
            {selectedTicket.updates?.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>Activity History</h4>
                {selectedTicket.updates.map((u) => (
                  <div key={u.id} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--outline-variant)', marginTop: '6px', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--outline)' }}>{new Date(u.created_at).toLocaleString()}</p>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{t(`tickets.status.${u.new_status}`)}</p>
                      {u.note && <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>{u.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Admin: Update Status */}
            {isAdmin && (
              <div style={{ borderTop: '1px solid var(--surface-container-high)', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>Update Ticket</h4>
                
                <label className="input-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Assignment</label>
                <select className="select" value={statusUpdate.assigned_to || ''} onChange={(e) => setStatusUpdate({ ...statusUpdate, assigned_to: e.target.value || null })} style={{ marginBottom: '0.75rem' }}>
                  <option value="">Unassigned</option>
                  {admins.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>

                <label className="input-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>Status</label>
                <select className="select" value={statusUpdate.status} onChange={(e) => setStatusUpdate({ ...statusUpdate, status: e.target.value })} style={{ marginBottom: '0.75rem' }}>
                  {statusOrder.map(s => (
                    <option key={s} value={s}>{t(`tickets.status.${s}`)}</option>
                  ))}
                  <option value="cancelled">{t('tickets.status.cancelled')}</option>
                </select>

                <textarea className="input textarea" placeholder="Add a note..." value={statusUpdate.note} onChange={(e) => setStatusUpdate({ ...statusUpdate, note: e.target.value })} rows={2} style={{ marginBottom: '0.75rem' }} />
                <button className="btn btn-primary btn-full" onClick={handleStatusUpdate}>Update Ticket</button>
              </div>
            )}

            <button className="btn btn-outline btn-full" style={{ marginTop: '0.75rem' }} onClick={() => setSelectedTicket(null)}>{t('common.close')}</button>
          </div>
        </div>
      )}

      {/* Ticket List */}
      {tickets.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">confirmation_number</span>
          <h3>{t('tickets.noTickets')}</h3>
          <p>Submit a repair request and track your device's progress here.</p>
        </div>
      ) : (
        <div className="ticket-list">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="ticket-card" onClick={() => loadTicketDetail(ticket)}>
              <div className={`ticket-status-icon ${ticket.status}`}>
                <span className="material-symbols-outlined">{statusIcons[ticket.status] || 'help'}</span>
              </div>
              <div className="ticket-info">
                <div className="ticket-title">{ticket.device_brand || ticket.device_type} {ticket.device_model}</div>
                <div className="ticket-meta">
                  #{ticket.ticket_number} • {t(`tickets.status.${ticket.status}`)}
                  {isAdmin && ticket.customer_name && ` • ${ticket.customer_name}`}
                </div>
              </div>
              <span className="material-symbols-outlined" style={{ color: 'var(--outline-variant)' }}>chevron_right</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TicketsPage;
