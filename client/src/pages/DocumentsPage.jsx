import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { documentAPI, userAPI } from '../services/api';
import { safeHref } from '../utils/safeUrl';

const DocumentsPage = () => {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const fileInputRef = useRef(null);

  const [docs, setDocs] = useState([]);
  const [sharedDocs, setSharedDocs] = useState([]);
  const [activeTab, setActiveTab] = useState('personal');
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState('personal');
  const [showUpload, setShowUpload] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  
  // Specific Admin Sharing State
  const [admins, setAdmins] = useState([]);
  const [shareModalDoc, setShareModalDoc] = useState(null);
  const [selectedAdminId, setSelectedAdminId] = useState('');

  useEffect(() => {
    loadDocs();
    if (isAdmin) loadSharedDocs();
    
    // Load admins for the share dropdown
    const loadAdmins = async () => {
      try {
        const adminList = await userAPI.getAdmins();
        setAdmins(adminList);
        if (adminList.length > 0) setSelectedAdminId(adminList[0].id);
      } catch (err) {
        console.error('Failed to load admins', err);
      }
    };
    loadAdmins();
  }, [isAdmin]);

  const loadDocs = async () => {
    try {
      const data = await documentAPI.getAll();
      setDocs(data);
    } catch (err) {
      console.error('Load docs error:', err);
    }
  };

  const loadSharedDocs = async () => {
    try {
      const data = await documentAPI.getShared();
      setSharedDocs(data);
    } catch (err) {
      console.error('Load shared docs error:', err);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', uploadType);
      await documentAPI.upload(formData, uploadType === 'print_job' ? 'print' : 'personal');
      setShowUpload(false);
      loadDocs();
    } catch (err) {
      console.error('Upload error:', err);
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleShareClick = (doc) => {
    if (doc.shared_with_admin || doc.shared_admin_id) {
      // Unshare
      handleShareSubmit(doc.id, false, null);
    } else {
      // Open modal to select admin
      setShareModalDoc(doc);
    }
  };

  const handleShareSubmit = async (id, shared, adminId) => {
    try {
      await documentAPI.share(id, shared, adminId);
      setShareModalDoc(null);
      loadDocs();
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await documentAPI.delete(id);
      setConfirmDelete(null);
      loadDocs();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const daysUntilDelete = (dateStr) => {
    const diff = new Date(dateStr) - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const totalUsed = docs.reduce((sum, d) => sum + (d.file_size || 0), 0);
  const quota = 50 * 1024 * 1024;
  const usagePercent = Math.round((totalUsed / quota) * 100);

  const personalDocs = docs.filter(d => d.doc_type !== 'print_job');
  const printDocs = docs.filter(d => d.doc_type === 'print_job');
  const currentDocs = activeTab === 'personal' ? personalDocs : activeTab === 'print' ? printDocs : sharedDocs;

  const docTypeIcons = {
    'application/pdf': 'picture_as_pdf',
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'gif_box',
    'application/msword': 'description',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'description',
  };

  return (
    <div className="page">
      <div className="section-header">
        <h2 className="section-title">{t('documents.title')}</h2>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowUpload(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload_file</span>
          {t('common.upload')}
        </button>
      </div>

      {/* Storage Quota */}
      <div className="doc-quota-card animate-fade-in">
        <div className="doc-quota-header">
          <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--primary)' }}>cloud</span>
          <span className="doc-quota-text">{t('documents.storageUsed', { used: formatSize(totalUsed), total: formatSize(quota) })}</span>
          <span className="badge badge-secondary" style={{ marginLeft: 'auto' }}>{usagePercent}%</span>
        </div>
        <div className="doc-quota-bar">
          <div
            className="doc-quota-fill"
            style={{ width: `${Math.min(usagePercent, 100)}%`, background: usagePercent > 80 ? 'var(--error)' : 'var(--secondary-container)' }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="doc-tabs">
        <button
          className={`doc-tab ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setActiveTab('personal')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>folder</span>
          {t('documents.personalVault')}
          {personalDocs.length > 0 && <span className="doc-tab-count">{personalDocs.length}</span>}
        </button>
        <button
          className={`doc-tab ${activeTab === 'print' ? 'active' : ''}`}
          onClick={() => setActiveTab('print')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>print</span>
          {t('documents.printJobs')}
          {printDocs.length > 0 && <span className="doc-tab-count">{printDocs.length}</span>}
        </button>
        {isAdmin && (
          <button
            className={`doc-tab ${activeTab === 'shared' ? 'active' : ''}`}
            onClick={() => setActiveTab('shared')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>share</span>
            Shared with You
            {sharedDocs.length > 0 && <span className="doc-tab-count">{sharedDocs.length}</span>}
          </button>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{t('documents.uploadDoc')}</h3>

            <div className="input-group" style={{ marginBottom: '1rem' }}>
              <label className="input-label">Document Type</label>
              <select className="select" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                <option value="personal">Personal Document</option>
                <option value="print_job">Print Job</option>
              </select>
            </div>

            <div
              className={`doc-upload-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" ref={fileInputRef} hidden onChange={handleFileSelect} />
              <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: 'var(--primary)', opacity: 0.6 }}>
                cloud_upload
              </span>
              <p style={{ fontWeight: 600, marginTop: '0.75rem' }}>
                {uploading ? t('common.loading') : 'Drop a file here or tap to browse'}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--outline)', marginTop: '0.25rem' }}>
                Max 10 MB • PDF, Word, Images
              </p>
            </div>

            <button className="btn btn-outline btn-full" style={{ marginTop: '1rem' }} onClick={() => setShowUpload(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{t('common.confirm')}</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--on-surface-variant)' }}>{t('documents.deleteWarning')}</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-full" style={{ background: 'var(--error)' }} onClick={() => handleDelete(confirmDelete)}>
                {t('common.delete')}
              </button>
              <button className="btn btn-outline" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModalDoc && (
        <div className="modal-overlay" onClick={() => setShareModalDoc(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Share Document</h3>
            <p style={{ marginBottom: '1rem', color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>
              Choose which admin you want to share <strong>{shareModalDoc.original_name || shareModalDoc.file_name}</strong> with.
            </p>
            
            <div className="input-group" style={{ marginBottom: '1.5rem' }}>
              <select 
                className="select" 
                value={selectedAdminId} 
                onChange={(e) => setSelectedAdminId(e.target.value)}
              >
                {admins.length === 0 && <option value="">Loading admins...</option>}
                {admins.map(admin => (
                  <option key={admin.id} value={admin.id}>{admin.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-primary btn-full" 
                onClick={() => handleShareSubmit(shareModalDoc.id, true, selectedAdminId)}
                disabled={!selectedAdminId}
              >
                Share Document
              </button>
              <button className="btn btn-outline" onClick={() => setShareModalDoc(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      {currentDocs.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">folder_open</span>
          <h3>{activeTab === 'shared' ? 'No shared documents' : t('documents.title')}</h3>
          <p>{activeTab === 'print' ? 'Upload files you need printed at the shop.' : 'Your uploaded documents will appear here.'}</p>
        </div>
      ) : (
        <div className="doc-list">
          {currentDocs.map((doc) => (
            <div key={doc.id} className="doc-card">
              <div className="doc-icon">
                <span className="material-symbols-outlined">
                  {docTypeIcons[doc.mime_type] || 'description'}
                </span>
              </div>
              <div className="doc-info">
                <div className="doc-name">{doc.original_name || doc.file_name}</div>
                <div className="doc-meta">
                  {formatSize(doc.file_size)}
                  {doc.auto_delete_at && ` • ${t('documents.autoDeleteIn', { days: daysUntilDelete(doc.auto_delete_at) })}`}
                  {activeTab === 'shared' && doc.owner_name && ` • by ${doc.owner_name}`}
                </div>
              </div>
              <div className="doc-actions">
                {doc.download_url && (
                  <a href={safeHref(doc.download_url)} target="_blank" rel="noopener noreferrer" className="btn-icon" title={t('common.download')}>
                    <span className="material-symbols-outlined">download</span>
                  </a>
                )}
                {activeTab !== 'shared' && (
                  <>
                    <button
                      className={`btn-icon ${doc.shared_with_admin || doc.shared_admin_id ? 'shared-active' : ''}`}
                      onClick={() => handleShareClick(doc)}
                      title={doc.shared_with_admin || doc.shared_admin_id ? t('documents.sharedWithAdmin') : t('documents.shareWithAdmin')}
                    >
                      <span className="material-symbols-outlined">
                        {doc.shared_with_admin || doc.shared_admin_id ? 'share' : 'share'}
                      </span>
                    </button>
                    <button className="btn-icon" onClick={() => setConfirmDelete(doc.id)} title={t('common.delete')}>
                      <span className="material-symbols-outlined" style={{ color: 'var(--error)' }}>delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentsPage;
