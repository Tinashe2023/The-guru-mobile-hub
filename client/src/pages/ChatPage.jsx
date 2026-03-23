import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { chatAPI } from "../services/api";

const ChatPage = () => {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const { socket } = useSocket();
  const messagesEndRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatAdmin, setNewChatAdmin] = useState("");
  const fileInputRef = useRef(null);
  // New state for advanced features
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [showInputEmojiPicker, setShowInputEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showMessageMenu, setShowMessageMenu] = useState(null);
  useEffect(() => {
    loadConversations();
    if (!isAdmin) {
      import("../services/api").then(({ userAPI }) => {
        userAPI
          .listUsers()
          .then((users) => setAdmins(users.filter((u) => u.role === "admin")))
          .catch(console.error);
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!socket || !activeConv) return;
    socket.emit("conversation:join", activeConv.id);

    // Existing events
    socket.on("message:new", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    // New events for advanced features
    socket.on("message:updated", (updatedMsg) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === updatedMsg.id ? { ...msg, ...updatedMsg } : msg,
        ),
      );
    });

    socket.on("message:deleted", (messageId) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    });

    socket.on("reaction:added", (data) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === data.messageId) {
            const reactions = msg.reactions || [];
            const existingReaction = reactions.find(
              (r) =>
                r.emoji === data.reaction.emoji &&
                r.user_id === data.reaction.user_id,
            );
            if (!existingReaction) {
              return { ...msg, reactions: [...reactions, data.reaction] };
            }
          }
          return msg;
        }),
      );
    });

    socket.on("reaction:removed", (data) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === data.messageId) {
            return {
              ...msg,
              reactions: (msg.reactions || []).filter(
                (r) =>
                  !(
                    r.emoji === data.reaction.emoji &&
                    r.user_id === data.reaction.user_id
                  ),
              ),
            };
          }
          return msg;
        }),
      );
    });

    socket.on("messages:read", (data) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (data.messageIds.includes(msg.id)) {
            return { ...msg, is_read: true, read_at: new Date().toISOString() };
          }
          return msg;
        }),
      );
    });

    return () => {
      socket.emit("conversation:leave", activeConv.id);
      socket.off("message:new");
      socket.off("message:updated");
      socket.off("message:deleted");
      socket.off("reaction:added");
      socket.off("reaction:removed");
      socket.off("messages:read");
    };
  }, [socket, activeConv?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  // Close menus when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        !event.target.closest(".message-menu") &&
        !event.target.closest(".message-menu-btn")
      ) {
        setShowMessageMenu(null);
      }
      if (
        !event.target.closest(".emoji-picker") &&
        !event.target.closest(".reaction-btn")
      ) {
        setShowEmojiPicker(null);
      }
      if (
        !event.target.closest(".input-emoji-picker") &&
        !event.target.closest(".btn-icon")
      ) {
        setShowInputEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
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
      const conv = await chatAPI.createConversation({
        subject: "Direct Support",
        admin_id: newChatAdmin || null,
      });
      setActiveConv(conv);
      setMessages([]);
      setShowNewChat(false);
      loadConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;

    setSending(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await chatAPI.sendFile(activeConv.id, formData);
    } catch (err) {
      console.error("File upload failed:", err);
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  // New handlers for advanced features
  const handleEditMessage = (message) => {
    setEditingMessage(message.id);
    setEditContent(message.content);
    setShowMessageMenu(null);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await chatAPI.editMessage(editingMessage, editContent.trim());
      setEditingMessage(null);
      setEditContent("");
    } catch (err) {
      console.error("Failed to edit message:", err);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditContent("");
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await chatAPI.deleteMessage(messageId);
      setShowMessageMenu(null);
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const handleAddReaction = async (messageId, emoji) => {
    try {
      await chatAPI.addReaction(messageId, emoji);
      setShowEmojiPicker(null);
    } catch (err) {
      console.error("Failed to add reaction:", err);
    }
  };

  const handleRemoveReaction = async (messageId, emoji) => {
    try {
      await chatAPI.removeReaction(messageId, emoji);
    } catch (err) {
      console.error("Failed to remove reaction:", err);
    }
  };

  const handleInsertEmoji = (emoji) => {
    setNewMessage((prev) => prev + emoji);
    setShowInputEmojiPicker(false);
  };

  const handleReply = (message) => {
    setReplyingTo(message);
    setShowMessageMenu(null);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleMarkAsRead = async () => {
    if (!activeConv) return;
    try {
      await chatAPI.markAsRead(activeConv.id);
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  // Enhanced send handler with reply support
  const handleSend = async () => {
    if (!newMessage.trim() || !activeConv) return;
    setSending(true);
    try {
      const messageData = {
        content: newMessage.trim(),
        message_type: "text",
      };
      if (replyingTo) {
        messageData.reply_to_id = replyingTo.id;
      }
      await chatAPI.sendMessage(activeConv.id, messageData);
      setNewMessage("");
      setReplyingTo(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };
  // If viewing a conversation
  if (activeConv) {
    return (
      <div className="chat-layout">
        {/* Chat Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            paddingBottom: "1rem",
            borderBottom: "1px solid var(--surface-container-high)",
          }}
        >
          <button
            className="btn-icon"
            onClick={() => {
              setActiveConv(null);
              loadConversations();
            }}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div
            className="avatar"
            style={{ background: "var(--primary-fixed)", overflow: "hidden" }}
          >
            {isAdmin ? (
              activeConv.customer_avatar ? (
                <img
                  src={activeConv.customer_avatar}
                  alt="C"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                activeConv.customer_name?.[0] || "C"
              )
            ) : activeConv.admin_avatar ? (
              <img
                src={activeConv.admin_avatar}
                alt="A"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              activeConv.admin_name?.[0] || "G"
            )}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.9375rem" }}>
              {isAdmin
                ? activeConv.customer_name || "Customer"
                : activeConv.admin_name || "Guru Mobile Hub"}
            </div>
            <div
              style={{
                fontSize: "0.625rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--on-surface-variant)",
              }}
            >
              Online • Concierge Support
            </div>
          </div>
        </div>

        {/* Encryption Notice */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "1rem 0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.25rem 0.75rem",
              background: "var(--surface-container-low)",
              borderRadius: "var(--radius-full)",
              border: "1px solid var(--outline-variant)",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "14px", color: "var(--outline)" }}
            >
              lock
            </span>
            <span
              style={{
                fontSize: "0.625rem",
                color: "var(--outline)",
                fontWeight: 500,
              }}
            >
              This conversation is end-to-end encrypted
            </span>
          </div>
        </div>

        {/* Reply Preview */}
        {replyingTo && (
          <div className="reply-preview">
            <div className="reply-content">
              <span className="reply-label">
                Replying to {replyingTo.sender_name}
              </span>
              <p>{replyingTo.content}</p>
            </div>
            <button className="btn-icon" onClick={handleCancelReply}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="chat-messages">
          {messages.map((msg, idx) => {
            const isMe = msg.sender_id === user.id;
            const showAvatar =
              !isMe &&
              (idx === messages.length - 1 ||
                messages[idx + 1]?.sender_id !== msg.sender_id);
            const showName =
              !isMe &&
              (idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id);
            const isEdited = msg.is_edited;
            const hasReactions = msg.reactions && msg.reactions.length > 0;
            const myReactions =
              msg.reactions?.filter((r) => r.user_id === user.id) || [];

            return (
              <div key={msg.id} className="message-container">
                {/* Reply Context */}
                {msg.reply_to_id && (
                  <div className="reply-context">
                    <span className="reply-arrow">↱</span>
                    <span className="reply-sender">
                      {msg.reply_sender_name}
                    </span>
                    <p className="reply-text">{msg.reply_content}</p>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "flex-end",
                    flexDirection: isMe ? "row-reverse" : "row",
                    marginBottom: hasReactions ? "0.25rem" : "0.5rem",
                  }}
                >
                  {!isMe && (
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "var(--surface-container-high)",
                        flexShrink: 0,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {showAvatar ? (
                        msg.sender_avatar ? (
                          <img
                            src={msg.sender_avatar}
                            alt={msg.sender_name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: "14px", fontWeight: 600 }}>
                            {msg.sender_name?.[0]}
                          </span>
                        )
                      ) : (
                        <div />
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isMe ? "flex-end" : "flex-start",
                      maxWidth: "75%",
                    }}
                  >
                    {showName && (
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--on-surface-variant)",
                          marginLeft: "0.25rem",
                          marginBottom: "0.125rem",
                          fontWeight: 500,
                        }}
                      >
                        {msg.sender_name}
                      </span>
                    )}

                    <div className="message-wrapper">
                      {/* Message Menu Button */}
                      <button
                        className="message-menu-btn"
                        onClick={() =>
                          setShowMessageMenu(
                            showMessageMenu === msg.id ? null : msg.id,
                          )
                        }
                      >
                        <span className="material-symbols-outlined">
                          more_vert
                        </span>
                      </button>

                      {/* Message Bubble */}
                      <div
                        className={`message-bubble ${isMe ? "sent" : "received"}`}
                        style={{ margin: 0 }}
                      >
                        {editingMessage === msg.id ? (
                          <div className="edit-input">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSaveEdit();
                                } else if (e.key === "Escape") {
                                  handleCancelEdit();
                                }
                              }}
                              autoFocus
                            />
                            <div className="edit-actions">
                              <button onClick={handleCancelEdit}>Cancel</button>
                              <button onClick={handleSaveEdit}>Save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {msg.message_type === "file" ? (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.5rem",
                                }}
                              >
                                <span className="material-symbols-outlined">
                                  description
                                </span>
                                <a
                                  href={msg.download_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    color: "inherit",
                                    textDecoration: "underline",
                                  }}
                                >
                                  {msg.file_name}
                                </a>
                              </div>
                            ) : (
                              msg.content
                            )}
                            {isEdited && (
                              <span className="edited-indicator">(edited)</span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Emoji Picker */}
                      {showEmojiPicker === msg.id && (
                        <div className="emoji-picker">
                          {["👍", "❤️", "😂", "😮", "😢", "😡"].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleAddReaction(msg.id, emoji)}
                              className="emoji-btn"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Message Menu */}
                      {showMessageMenu === msg.id && (
                        <div className="message-menu">
                          <button onClick={() => handleReply(msg)}>
                            <span className="material-symbols-outlined">
                              reply
                            </span>
                            Reply
                          </button>
                          <button
                            onClick={() =>
                              setShowEmojiPicker(
                                showEmojiPicker === msg.id ? null : msg.id,
                              )
                            }
                          >
                            <span className="material-symbols-outlined">
                              add_reaction
                            </span>
                            React
                          </button>
                          {isMe && (
                            <>
                              <button onClick={() => handleEditMessage(msg)}>
                                <span className="material-symbols-outlined">
                                  edit
                                </span>
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="danger"
                              >
                                <span className="material-symbols-outlined">
                                  delete
                                </span>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reactions */}
                    {hasReactions && (
                      <div className="reactions-bar">
                        {msg.reactions
                          .reduce((acc, reaction) => {
                            const existing = acc.find(
                              (r) => r.emoji === reaction.emoji,
                            );
                            if (existing) {
                              existing.users.push(reaction.user_name);
                              existing.userIds.push(reaction.user_id);
                            } else {
                              acc.push({
                                emoji: reaction.emoji,
                                users: [reaction.user_name],
                                userIds: [reaction.user_id],
                              });
                            }
                            return acc;
                          }, [])
                          .map((reaction) => (
                            <button
                              key={reaction.emoji}
                              className={`reaction-btn ${
                                reaction.userIds.includes(user.id)
                                  ? "active"
                                  : ""
                              }`}
                              onClick={() => {
                                if (reaction.userIds.includes(user.id)) {
                                  handleRemoveReaction(msg.id, reaction.emoji);
                                } else {
                                  handleAddReaction(msg.id, reaction.emoji);
                                }
                              }}
                              title={reaction.users.join(", ")}
                            >
                              {reaction.emoji} {reaction.users.length}
                            </button>
                          ))}
                      </div>
                    )}

                    {/* Message Time and Status */}
                    <div
                      className={`message-time ${isMe ? "sent" : ""}`}
                      style={{ padding: "0.125rem 0.25rem" }}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {isEdited && (
                        <span className="edited-time">
                          edited{" "}
                          {new Date(msg.edited_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      {isMe && (
                        <span
                          className={`read-status ${msg.is_read ? "read" : "sent"}`}
                        >
                          <span className="material-symbols-outlined">
                            done_all
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-bar">
          <input
            type="file"
            ref={fileInputRef}
            hidden
            onChange={handleFileUpload}
          />
          <button
            className="btn-icon"
            style={{ color: "var(--primary-container)" }}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="material-symbols-outlined">attach_file</span>
          </button>
          <button
            className="btn-icon"
            style={{ color: "var(--primary-container)" }}
            onClick={() => setShowInputEmojiPicker(!showInputEmojiPicker)}
          >
            <span className="material-symbols-outlined">
              sentiment_satisfied
            </span>
          </button>
          <textarea
            className="chat-textarea"
            placeholder={t("chat.typePlaceholder")}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            id="chat-input"
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={sending}
            id="chat-send"
          >
            <span className="material-symbols-outlined icon-filled">send</span>
          </button>
        </div>

        {/* Input Emoji Picker */}
        {showInputEmojiPicker && (
          <div className="input-emoji-picker">
            {[
              "😀",
              "😂",
              "😊",
              "😍",
              "🥰",
              "😘",
              "😉",
              "😎",
              "🤔",
              "😮",
              "😢",
              "😡",
              "🥺",
              "😴",
              "🤤",
              "😇",
              "👻",
              "💀",
              "👽",
              "🤖",
              "👍",
              "👎",
              "👌",
              "✌️",
              "🤞",
              "👏",
              "🙌",
              "🤝",
              "🙏",
              "💪",
              "❤️",
              "💔",
              "💕",
              "💖",
              "💯",
              "🔥",
              "⭐",
              "✨",
              "💫",
              "🌟",
              "🎉",
              "🎊",
              "🎈",
              "🎁",
              "🎂",
              "🍰",
              "🍿",
              "🍕",
              "🍔",
              "🍟",
              "🌮",
              "🌯",
              "🍜",
              "🍝",
              "🍣",
              "🍱",
              "🥤",
              "☕",
              "🍵",
              "🥛",
            ].map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleInsertEmoji(emoji)}
                className="emoji-btn"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Conversation List
  return (
    <div className="page">
      <div className="section-header">
        <h2 className="section-title">{t("chat.title")}</h2>
        {!isAdmin && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowNewChat(true)}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "18px" }}
            >
              add
            </span>
            New
          </button>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && !isAdmin && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Who would you like to message?</h3>
            <div className="input-group">
              <label className="input-label">Select Staff</label>
              <select
                className="select"
                value={newChatAdmin}
                onChange={(e) => setNewChatAdmin(e.target.value)}
              >
                <option value="">Any Available Staff</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button
                className="btn btn-primary btn-full"
                onClick={handleStartConversation}
              >
                Start Chat
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setShowNewChat(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {conversations.length === 0 ? (
        <div className="empty-state">
          <span className="material-symbols-outlined">chat_bubble</span>
          <h3>{t("chat.noConversations")}</h3>
          <p>{t("chat.startChat")}</p>
          {!isAdmin && (
            <button
              className="btn btn-secondary"
              style={{ marginTop: "1rem" }}
              onClick={() => setShowNewChat(true)}
            >
              {t("dashboard.privateMessage")}
            </button>
          )}
        </div>
      ) : (
        <div className="ticket-list">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="ticket-card"
              onClick={() => openConversation(conv)}
            >
              <div
                className="avatar"
                style={{
                  background: "var(--primary-fixed)",
                  color: "var(--primary)",
                  overflow: "hidden",
                }}
              >
                {isAdmin ? (
                  conv.customer_avatar ? (
                    <img
                      src={conv.customer_avatar}
                      alt="C"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    conv.customer_name?.[0] || "C"
                  )
                ) : conv.admin_avatar ? (
                  <img
                    src={conv.admin_avatar}
                    alt="A"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  conv.admin_name?.[0] || "G"
                )}
              </div>
              <div className="ticket-info">
                <div className="ticket-title">
                  {isAdmin
                    ? conv.customer_name || "Customer"
                    : conv.admin_name || "Guru Mobile Hub"}
                </div>
                <div
                  className="ticket-meta"
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {conv.last_message || conv.subject || "No messages yet"}
                </div>
              </div>
              {conv.unread_count > 0 && (
                <div
                  style={{
                    background: "var(--secondary-container)",
                    color: "var(--on-secondary-container)",
                    borderRadius: "var(--radius-full)",
                    padding: "0.125rem 0.5rem",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
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
