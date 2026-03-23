import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { chatAPI } from '../services/api';

const ChatPage = () => {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const { socket } = useSocket();
  const messagesEndRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatAdmin, setNewChatAdmin] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => { 
    loadConversations(); 
    if (!isAdmin) {
      import('../services/api').then(({ userAPI }) => {
        userAPI.listUsers().then(users => setAdmins(users.filter(u => u.role === 'admin'))).catch(console.error);
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!socket || !activeConv) return;
    socket.emit('conversation:join', activeConv.id);
    socket.on('message:new', (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    return () => {
      socket.emit('conversation:leave', activeConv.id);
      socket.off('message:new');
    };
  }, [socket, activeConv?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await chatAPI.getConversations();
      setConversations(data);
    } catch (err) {
      console.error(err);
    }
  };

  const openConversation = async (conv) => {
    setActiveConv(conv);
    try {
      const msgs = await chatAPI.getMessages(conv.id);
      setMessages(msgs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartConversation = async () => {
    try {
      const conv = await chatAPI.createConversation({ subject: 'Direct Support', admin_id: newChatAdmin || null });
      setActiveConv(conv);
      setMessages([]);
      setShowNewChat(false);
      loadConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConv) return;
    setSending(true);
    try {
      await chatAPI.sendMessage(activeConv.id, { content: newMessage.trim(), message_type: 'text' });
      setNewMessage('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;
    
    setSending(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      await chatAPI.sendFile(activeConv.id, formData);
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // If viewing a conversation
  if (activeConv) {
    return (
      <div className="chat-layout">
        {/* Chat Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--surface-container-high)' }}>
          <button className="btn-icon" onClick={() => { setActiveConv(null); loadConversations(); }}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="avatar" style={{ background: 'var(--primary-fixed)', overflow: 'hidden' }}>
            {isAdmin ? (
               activeConv.customer_avatar ? <img src={activeConv.customer_avatar} alt="C" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : (activeConv.customer_name?.[0] || 'C')
            ) : (
               activeConv.admin_avatar ? <img src={activeConv.admin_avatar} alt="A" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : (activeConv.admin_name?.[0] || 'G')
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
              {isAdmin ? (activeConv.customer_name || 'Customer') : (activeConv.admin_name || 'Guru Mobile Hub')}
            </div>
            <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--on-surface-variant)' }}>
              Online • Concierge Support
            </div>
          </div>
        </div>

        {/* Encryption Notice */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.75rem', background: 'var(--surface-container-low)', borderRadius: 'var(--radius-full)', border: '1px solid var(--outline-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--outline)' }}>lock</span>
            <span style={{ fontSize: '0.625rem', color: 'var(--outline)', fontWeight: 500 }}>This conversation is end-to-end encrypted</span>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map((msg, idx) => {
            const isMe = msg.sender_id === user.id;
            const showAvatar = !isMe && (idx === messages.length - 1 || messages[idx + 1]?.sender_id !== msg.sender_id);
            const showName = !isMe && (idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id);
            
            return (
              <div key={msg.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexDirection: isMe ? 'row-reverse' : 'row', marginBottom: '0.5rem' }}>
                {!isMe && (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--surface-container-high)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {showAvatar ? (
                      msg.sender_avatar ? <img src={msg.sender_avatar} alt={msg.sender_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{fontSize:'12px', fontWeight:600}}>{msg.sender_name?.[0]}</span>
                    ) : <div />}
                  </div>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                  {showName && (
                    <span style={{ fontSize: '0.625rem', color: 'var(--on-surface-variant)', marginLeft: '0.25rem', marginBottom: '0.125rem' }}>{msg.sender_name}</span>
                  )}
                  <div className={`message-bubble ${isMe ? 'sent' : 'received'}`} style={{ margin: 0 }}>
                    {msg.message_type === 'file' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="material-symbols-outlined">description</span>
                        <a href={msg.download_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                          {msg.file_name}
                        </a>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  <div className={`message-time ${isMe ? 'sent' : ''}`} style={{ padding: '0.125rem 0.25rem' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMe && (
                      <span className="material-symbols-outlined" style={{ fontSize: '14px', marginLeft: '4px', color: 'var(--surface-tint)' }}>done_all</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-bar">
          <input type="file" ref={fileInputRef} hidden onChange={handleFileUpload} />
          <button className="btn-icon" style={{ color: 'var(--primary-container)' }} onClick={() => fileInputRef.current?.click()}>
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <textarea
            className="chat-textarea"
            placeholder={t('chat.typePlaceholder')}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            id="chat-input"
          />
          <button className="send-btn" onClick={handleSend} disabled={sending} id="chat-send">
            <span className="material-symbols-outlined icon-filled">send</span>
          </button>
        </div>
      </div>
    );
  }

  // Conversation List
  return (
    <div className="page">
      <div className="section-header">
        <h2 className="section-title">{t('chat.title')}</h2>
        {!isAdmin && (
          <button className="btn btn-secondary btn-sm" onClick={() => setShowNewChat(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            New
          </button>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && !isAdmin && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Who would you like to message?</h3>
            <div className="input-group">
              <label className="input-label">Select Staff</label>
              <select className="select" value={newChatAdmin} onChange={e => setNewChatAdmin(e.target.value)}>
                <option value="">Any Available Staff</option>
                {admins.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary btn-full" onClick={handleStartConversation}>Start Chat</button>
              <button className="btn btn-outline" onClick={() => setShowNewChat(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">chat_bubble</span>
          <h3>{t('chat.noConversations')}</h3>
          <p>{t('chat.startChat')}</p>
          {!isAdmin && (
            <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => setShowNewChat(true)}>
              {t('dashboard.privateMessage')}
            </button>
          )}
        </div>
      ) : (
        <div className="ticket-list">
          {conversations.map((conv) => (
            <div key={conv.id} className="ticket-card" onClick={() => openConversation(conv)}>
              <div className="avatar" style={{ background: 'var(--primary-fixed)', color: 'var(--primary)', overflow: 'hidden' }}>
                {isAdmin ? (
                  conv.customer_avatar ? <img src={conv.customer_avatar} alt="C" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : (conv.customer_name?.[0] || 'C')
                ) : (
                  conv.admin_avatar ? <img src={conv.admin_avatar} alt="A" style={{width:'100%', height:'100%', objectFit:'cover'}}/> : (conv.admin_name?.[0] || 'G')
                )}
              </div>
              <div className="ticket-info">
                <div className="ticket-title">
                  {isAdmin ? (conv.customer_name || 'Customer') : (conv.admin_name || 'Guru Mobile Hub')}
                </div>
                <div className="ticket-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.last_message || conv.subject || 'No messages yet'}
                </div>
              </div>
              {conv.unread_count > 0 && (
                <div style={{ background: 'var(--secondary-container)', color: 'var(--on-secondary-container)', borderRadius: 'var(--radius-full)', padding: '0.125rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>
                  {conv.unread_count}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatPage;
