import { MessageCircle, Search, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { AdminLayout } from './AdminLayout';
import { cn } from '../../lib/utils';

interface SupportConversation {
  id: string;
  client_id: string;
  last_message_at: string;
  created_at: string;
  client: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
}

export default function AdminSupport() {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchConversations();

    // Subscribe to new messages to update the list
    const channel = supabase
      .channel('admin-support-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchConversations() {
    try {
      setLoading(true);
      // Fetch conversations flagged as support
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          client_id,
          last_message_at,
          created_at,
          profiles:client_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('is_support', true)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Map to the desired interface and fetch last message for each
      const formatted = await Promise.all((data || []).map(async (convo: any) => {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at, sender_id')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          ...convo,
          client: convo.profiles,
          last_message: lastMsg
        };
      }));

      setConversations(formatted);
    } catch (err) {
      console.error('[AdminSupport] Error fetching support chats:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredConversations = conversations.filter(convo => 
    convo.client?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    convo.client?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    convo.last_message?.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout title="Support Messages">
      <div className="space-y-6">
        {/* Header/Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50" size={18} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-outline-variant/10 rounded-xl text-sm focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="text-sm text-on-surface-variant font-medium">
            {conversations.length} total requests
          </div>
        </div>

        {/* Conversations List */}
        <div className="bg-white rounded-[2rem] border border-outline-variant/10 overflow-hidden silk-shadow">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-on-surface-variant">Loading support requests...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-4 text-on-surface-variant/30">
                <MessageCircle size={32} />
              </div>
              <h3 className="text-lg font-bold text-on-surface mb-2">No support requests</h3>
              <p className="text-sm text-on-surface-variant">When users start a live chat from the Help center, they will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/5">
              {filteredConversations.map((convo) => (
                <Link
                  key={convo.id}
                  to={`/partner/support/${convo.id}`}
                  className="flex items-center gap-4 p-6 hover:bg-surface-container-lowest transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-outline-variant/10 shrink-0">
                    <img
                      src={convo.client?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(convo.client?.full_name || 'U')}&background=random`}
                      alt={convo.client?.full_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                        {convo.client?.full_name}
                      </h4>
                      <span className="text-[10px] text-on-surface-variant/60 font-medium">
                        {new Date(convo.last_message_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-on-surface-variant truncate">
                      {convo.last_message?.content || 'No messages yet'}
                    </p>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <MessageCircle size={14} className="group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

