import { ArrowLeft, Check, CheckCheck, Send, User } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { AdminLayout } from './AdminLayout';
import { cn } from '../../lib/utils';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'system';
  read_at: string | null;
  created_at: string;
}

interface ConversationDetails {
  id: string;
  client_id: string;
  client: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

export default function AdminChatRoom() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId && user) {
      fetchConversation();
      fetchMessages();

      const channel = supabase
        .channel(`admin-chat-${conversationId}`)
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
            if (newMsg.sender_id !== user.id) {
              markAsRead(newMsg.id);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [conversationId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchConversation() {
    if (!conversationId) return;
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          client_id,
          profiles:client_id (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('id', conversationId)
        .single();

      if (error) throw error;
      setConversation({
        ...data,
        client: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
      });
    } catch (err) {
      console.error('[AdminChat] Error fetching conversation:', err);
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
      console.error('[AdminChat] Error fetching messages:', err);
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
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        message_type: 'text',
      });

      if (error) throw error;

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
    } catch (err) {
      console.error('[AdminChat] Error sending message:', err);
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  }

  return (
    <AdminLayout title={`Support: ${conversation?.client.full_name || 'Loading...'}`}>
      <div className="flex flex-col h-[calc(100vh-12rem)] bg-white rounded-[2rem] border border-outline-variant/10 silk-shadow overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container-lowest">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/partner/support')}
              className="p-2 rounded-full hover:bg-surface-container transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-outline-variant/10">
                <img
                  src={conversation?.client.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(conversation?.client.full_name || 'U')}&background=random`}
                  alt={conversation?.client.full_name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="font-bold text-on-surface leading-tight">{conversation?.client.full_name}</h3>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-medium">{conversation?.client.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm',
                    isOwn 
                      ? 'bg-primary text-white rounded-br-none' 
                      : 'bg-surface-container-low text-on-surface rounded-bl-none border border-outline-variant/5'
                  )}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className={cn(
                      'flex items-center justify-end gap-1 mt-1 text-[10px]',
                      isOwn ? 'text-white/60' : 'text-on-surface-variant/40'
                    )}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isOwn && (msg.read_at ? <CheckCheck size={12} /> : <Check size={12} />)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/10">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your response..."
              className="flex-1 px-4 py-2 bg-white border border-outline-variant/10 rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50 transition-all active:scale-95"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
