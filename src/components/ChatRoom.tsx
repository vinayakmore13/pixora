import {
  Camera,
  Check,
  CheckCheck,
  ChevronLeft,
  MoreVertical,
  Send,
  Smile,
  Trash2,
  Calendar,
  ArrowLeft,
  Plus,
  LayoutGrid,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'system' | 'event_created' | 'booking_confirmed';
  metadata: any;
  read_at: string | null;
  created_at: string;
}

interface ConversationDetails {
  id: string;
  client_id: string;
  photographer_id: string;
  booking_id: string | null;
  other_user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    user_type: string;
  };
}

export function ChatRoom() {
  const { conversationId } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch conversation details + messages
  useEffect(() => {
    if (conversationId && user) {
      fetchConversation();
      fetchMessages();

      // Subscribe to new messages
      const channel = supabase
        .channel(`chat-${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const newMsg = payload.new as Message;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            // Mark as read if it's from the other user
            if (newMsg.sender_id !== user.id) {
              markAsRead(newMsg.id);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const oldMsg = payload.old as { id: string };
            setMessages((prev) => prev.filter((m) => m.id !== oldMsg.id));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [conversationId, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark unread messages as read on load
  useEffect(() => {
    if (messages.length > 0 && user) {
      const unreadFromOthers = messages.filter(
        (m) => m.sender_id !== user.id && !m.read_at
      );
      unreadFromOthers.forEach((m) => markAsRead(m.id));
    }
  }, [messages, user]);

  async function fetchConversation() {
    if (!conversationId || !user) return;
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) throw error;

      const otherId =
        data.client_id === user.id ? data.photographer_id : data.client_id;

      const { data: otherProfile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, user_type')
        .eq('id', otherId)
        .single();

      setConversation({
        ...data,
        other_user: otherProfile || {
          id: otherId,
          full_name: 'Unknown User',
          avatar_url: null,
          user_type: 'user',
        },
      });
    } catch (err) {
      console.error('[Chat] Error fetching conversation:', err);
    }
  }

  async function fetchMessages() {
    if (!conversationId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('[Chat] Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(messageId: string) {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('id', messageId)
      .is('read_at', null);
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!newMessage.trim() || !conversationId || !user || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const { data, error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        message_type: 'text',
      }).select().single();

      if (error) throw error;

      // Optimistically append the sent message to avoid requiring immediate realtime sync
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data as Message];
      });

      // Update last_message_at on conversation
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (err) {
      console.error('[Chat] Error sending message:', err);
      setNewMessage(content); // Restore message on error
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!window.confirm('Unsend this message?')) return;
    try {
      // Optimistic update
      setMessages(prev => prev.filter(m => m.id !== messageId));
      
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user?.id); // Extra safety

      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('[Chat] Error deleting message:', err);
      // If error, reload messages to get the real state
      fetchMessages();
    }
  }

  async function handleDeleteChat() {
    if (!window.confirm('Delete this conversation entirely? This deletes it for everyone and cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);
      
      if (error) throw error;
      navigate('/messages', { replace: true });
    } catch (err) {
      console.error('[Chat] Error deleting chat:', err);
      alert('Failed to delete chat.');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function formatDateSeparator(dateStr: string) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }

  function shouldShowDateSeparator(index: number): boolean {
    if (index === 0) return true;
    const curr = new Date(messages[index].created_at).toDateString();
    const prev = new Date(messages[index - 1].created_at).toDateString();
    return curr !== prev;
  }

  const isPhotographer = profile?.user_type === 'photographer';
  const name = conversation?.other_user?.full_name || 'Unknown User';
  const initials = name.substring(0, 1).toUpperCase();

  return (
    <div className="h-[100dvh] pt-20 bg-surface flex flex-col overflow-hidden">
      {/* Chat Navigation Header */}
      <div className="shrink-0 z-40 bg-white border-b border-outline-variant/10 px-4 md:px-8 py-3 shadow-sm relative">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/messages')}
              className="p-2 rounded-full hover:bg-surface-container-low transition-colors"
            >
              <ArrowLeft size={20} className="text-on-surface-variant" />
            </button>
            {conversation && (
              <Link
                to={
                  conversation.other_user.user_type === 'photographer'
                    ? `/photographer/${conversation.other_user.id}`
                    : '#'
                }
                className="flex items-center gap-3 group"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant/10 bg-gradient-to-tr from-primary to-rose-400 flex items-center justify-center text-white font-medium">
                  {conversation.other_user.avatar_url ? (
                    <img
                      src={conversation.other_user.avatar_url}
                      alt={name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div>
                  <h2 className="font-bold text-on-surface group-hover:text-primary transition-colors">
                    {name}
                  </h2>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/50">
                    {conversation.other_user.user_type === 'photographer' ? '📷 Photographer' : '👤 Client'}
                  </p>
                </div>
              </Link>
            )}
          </div>

          {/* Actions Menu */}
          <div className="flex items-center gap-2 relative">
            {isPhotographer && conversation && (
              <Link
                to={`/create-event?client=${conversation.other_user.id}&conversation=${conversationId}`}
                className="hidden md:flex items-center gap-2 bg-surface-container-low text-on-surface px-4 py-2 rounded-full text-sm font-bold hover:bg-outline-variant/10 transition-all active:scale-95 shadow-sm"
              >
                <Plus size={16} /> Create Event
              </Link>
            )}
            <button 
              onClick={() => setShowChatMenu(!showChatMenu)}
              className="p-2 rounded-full hover:bg-surface-container-low transition-colors"
            >
              <MoreVertical size={20} className="text-on-surface-variant" />
            </button>

            {showChatMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowChatMenu(false)} />
                <div className="absolute top-12 right-0 bg-white shadow-xl border border-outline-variant/10 rounded-2xl w-48 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  {isPhotographer && (
                    <button 
                      onClick={() => {
                        setShowChatMenu(false);
                        navigate(`/create-event?client=${conversation?.other_user?.id}&conversation=${conversationId}`);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-surface-container flex items-center gap-3 transition-colors text-sm font-bold text-on-surface"
                    >
                      <Calendar size={16} /> Create Event
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setShowChatMenu(false);
                      handleDeleteChat();
                    }}
                    className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors text-sm font-bold"
                  >
                    <Trash2 size={16} /> Delete Chat
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 relative">
        <div className="max-w-3xl mx-auto flex flex-col space-y-4 min-h-full justify-end pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Camera size={28} className="text-primary" />
              </div>
              <h3 className="text-lg font-bold text-on-surface mb-2">Start the conversation</h3>
              <p className="text-sm text-on-surface-variant max-w-sm mx-auto">
                {isPhotographer
                  ? 'Say hello to your client and discuss the shoot details!'
                  : 'Ask about availability, share your vision, and plan together!'}
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isOwn = msg.sender_id === user?.id;
              const isSystem = msg.message_type !== 'text';

              return (
                <React.Fragment key={msg.id}>
                  {/* Date separator */}
                  {shouldShowDateSeparator(index) && (
                    <div className="flex items-center justify-center py-4">
                      <span className="bg-surface-container-low text-on-surface-variant/60 text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full">
                        {formatDateSeparator(msg.created_at)}
                      </span>
                    </div>
                  )}

                  {/* System message */}
                  {msg.message_type === 'event_created' ? (
                    <div className="flex justify-center py-4">
                      <div className="bg-white border border-outline-variant/20 rounded-[2rem] p-6 silk-shadow max-w-sm w-full text-center group transition-all hover:border-primary/30 border-b-4 border-b-primary/10">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                          <Calendar size={28} className="text-primary" />
                        </div>
                        <h4 className="font-bold text-on-surface mb-1">{msg.metadata?.event_name || 'Event Created'}</h4>
                        <p className="text-xs text-on-surface-variant mb-4 uppercase tracking-widest font-bold">New Gallery Ready</p>
                        <Link 
                          to={`/gallery/${msg.metadata?.event_id}`}
                          className="inline-flex items-center justify-center gap-2 bg-primary text-white px-8 py-3 rounded-full text-sm font-bold shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95"
                        >
                          <LayoutGrid size={16} />
                          View Photos
                        </Link>
                      </div>
                    </div>
                  ) : isSystem ? (
                    <div className="flex justify-center py-2">
                      <div className="bg-primary/10 text-primary text-sm font-medium px-5 py-2 rounded-2xl max-w-md text-center">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    /* User message */
                    <div className={cn('flex py-1.5 w-full', isOwn ? 'justify-end' : 'justify-start')}>
                      <div className={cn('flex items-end gap-2 group relative', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                        
                        {!isOwn && (
                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 self-end mb-1 bg-gradient-to-tr from-primary to-rose-400 flex items-center justify-center text-white text-xs font-medium">
                            {conversation?.other_user?.avatar_url ? (
                              <img src={conversation.other_user.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{initials}</span>
                            )}
                          </div>
                        )}

                        <div
                          className={cn(
                            'max-w-[75%] md:max-w-md px-5 py-3.5 text-[15px] leading-relaxed shadow-sm transition-all',
                            isOwn
                              ? 'bg-gradient-to-br from-primary to-rose-500 text-white rounded-t-[1.5rem] rounded-bl-[1.5rem] rounded-br-sm shadow-primary/20'
                              : 'bg-white border border-outline-variant/20 text-on-surface rounded-t-[1.5rem] rounded-br-[1.5rem] rounded-bl-sm'
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <div
                            className={cn(
                              'flex items-center gap-1 mt-1.5',
                              isOwn ? 'justify-end text-white/70' : 'justify-start text-on-surface-variant/50'
                            )}
                          >
                            <span className="text-[10px] font-medium tracking-wide">{formatTime(msg.created_at)}</span>
                            {isOwn && (
                              msg.read_at ? (
                                <CheckCheck size={14} className="text-white/90" />
                              ) : (
                                <Check size={14} />
                              )
                            )}
                          </div>
                        </div>

                        {/* Unsend Action */}
                        {isOwn && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            title="Unsend"
                            className="p-2 text-on-surface-variant/0 hover:text-red-500 group-hover:text-on-surface-variant/50 hover:bg-red-50 rounded-full transition-all focus:text-red-500 focus:bg-red-50 focus:outline-none"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 bg-white border-t border-outline-variant/10 px-4 md:px-8 py-3 z-40 pb-safe">
        <form
          onSubmit={handleSend}
          className="max-w-3xl mx-auto flex items-end gap-3"
        >
          {profile?.user_type === 'photographer' && (
            <button
              type="button"
              onClick={() => navigate(`/create-event?client=${conversation?.other_user.id}&conversation=${conversationId}`)}
              className="p-3.5 bg-surface-container-low text-on-surface-variant rounded-full hover:bg-surface-container-high transition-all active:scale-90 shrink-0 shadow-sm flex items-center justify-center group"
              title="Create Event"
            >
              <Plus size={18} className="group-hover:text-primary transition-colors" />
            </button>
          )}
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className="flex-1 bg-white border border-outline-variant/20 rounded-full py-3.5 px-6 text-[15px] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none max-h-32 shadow-sm transition-all"
            style={{ minHeight: '52px' }}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={cn(
              'p-3.5 rounded-full transition-all active:scale-90 shrink-0 shadow-sm flex items-center justify-center',
              newMessage.trim()
                ? 'bg-primary text-white shadow-primary/30 hover:brightness-110'
                : 'bg-surface-container-low text-on-surface-variant'
            )}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

