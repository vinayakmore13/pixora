import { ArrowLeft, Camera, MessageCircle, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { cn } from '../lib/utils';

interface Conversation {
  id: string;
  client_id: string;
  photographer_id: string;
  booking_id: string | null;
  last_message_at: string;
  created_at: string;
  // Joined data
  other_user?: {
    full_name: string;
    avatar_url: string | null;
    user_type: string;
  };
  last_message?: {
    content: string;
    sender_id: string;
    message_type: string;
    created_at: string;
  };
  unread_count?: number;
}

export function MessagesList() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      fetchConversations();
      // Subscribe to real-time updates
      const channel = supabase
        .channel('conversations-list')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            fetchConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  async function fetchConversations() {
    if (!user) return;
    try {
      setLoading(true);

      // Fetch conversations where user is either client or photographer
      const { data: convos, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`client_id.eq.${user.id},photographer_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      if (!convos || convos.length === 0) {
        setConversations([]);
        return;
      }

      // Get the "other" user's profile for each conversation
      const otherUserIds = convos.map((c) =>
        c.client_id === user.id ? c.photographer_id : c.client_id
      );

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, user_type')
        .in('id', otherUserIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Get last message for each conversation
      const enrichedConvos = await Promise.all(
        convos.map(async (conv) => {
          const otherId =
            conv.client_id === user.id ? conv.photographer_id : conv.client_id;

          // Fetch last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, sender_id, message_type, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Fetch unread count
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .is('read_at', null);

          let profile = profileMap.get(otherId);
          if (!profile) {
            try {
              const { data: pData } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, user_type')
                .eq('id', otherId)
                .single();
              if (pData) profile = pData;
            } catch (e) {
              console.error('Fallback profile fetch failed', e);
            }
          }
          return {
            ...conv,
            other_user: profile ? {
              ...profile,
              full_name: profile.full_name || 'Unknown User'
            } : {
              full_name: 'Unknown User',
              avatar_url: null,
              user_type: 'user',
            },
            last_message: lastMsg || undefined,
            unread_count: count ?? 0,
          };
        })
      );

      setConversations(enrichedConvos);
    } catch (err) {
      console.error('[Messages] Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredConversations = conversations.filter((c) =>
    c.other_user?.full_name
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      const mins = Math.floor(diffMs / (1000 * 60));
      return mins <= 0 ? 'Just now' : `${mins}m ago`;
    }
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
    if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getMessagePreview(conv: Conversation): string {
    if (!conv.last_message) return 'No messages yet';
    if (conv.last_message.message_type === 'system') return conv.last_message.content;
    if (conv.last_message.message_type === 'event_created') return '📸 Event created';
    if (conv.last_message.message_type === 'booking_confirmed') return '✅ Booking confirmed';
    const prefix = conv.last_message.sender_id === user?.id ? 'You: ' : '';
    const content = conv.last_message.content;
    return `${prefix}${content.length > 50 ? content.substring(0, 50) + '...' : content}`;
  }

  return (
    <div className="pt-24 pb-20 min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-full hover:bg-surface-container-low transition-colors"
            >
              <ArrowLeft size={20} className="text-on-surface-variant" />
            </button>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-on-surface">Messages</h1>
          </div>
          {profile?.user_type === 'couple' && (
            <Link
              to="/marketplace"
              className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
            >
              <Camera size={16} /> Find Photographers
            </Link>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-outline-variant/20 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
          />
        </div>

        {/* Conversations List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="bg-white p-12 rounded-[2.5rem] silk-shadow border border-outline-variant/5 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={32} className="text-on-surface-variant" />
            </div>
            <h3 className="text-xl font-bold text-on-surface mb-2">No conversations yet</h3>
            <p className="text-on-surface-variant mb-6">
              {profile?.user_type === 'couple'
                ? 'Find a photographer and start chatting to plan your perfect shoot!'
                : 'Clients will appear here when they reach out to you.'}
            </p>
            {profile?.user_type === 'couple' && (
              <Link
                to="/marketplace"
                className="inline-flex items-center gap-2 signature-gradient text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all"
              >
                <Camera size={20} /> Browse Photographers
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map((conv) => {
              const hasUnread = (conv.unread_count ?? 0) > 0;
              const name = conv.other_user?.full_name || 'Unknown User';
              const initials = name.substring(0, 1).toUpperCase();

              return (
                <Link
                  key={conv.id}
                  to={`/messages/${conv.id}`}
                  className={cn(
                    'flex items-center gap-4 py-3 px-2 sm:px-4 transition-all hover:bg-surface-container-low/50 active:bg-surface-container-low group'
                  )}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-gradient-to-tr from-primary to-rose-400 flex items-center justify-center text-white text-xl font-medium shadow-sm">
                      {conv.other_user?.avatar_url ? (
                        <img
                          src={conv.other_user.avatar_url}
                          alt={name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className={cn('text-[15px] sm:text-base truncate', hasUnread ? 'font-bold text-on-surface' : 'font-medium text-on-surface')}>
                        {name}
                      </h3>
                    </div>
                    <div className="flex items-center pr-4">
                      <p className={cn(
                        'text-sm truncate',
                        hasUnread ? 'text-on-surface font-bold' : 'text-on-surface-variant'
                      )}>
                        {getMessagePreview(conv)}
                      </p>
                      <span className="text-sm text-on-surface-variant/60 shrink-0 ml-1.5">
                        · {conv.last_message ? formatTime(conv.last_message.created_at) : formatTime(conv.created_at)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Unread Indicator */}
                  {hasUnread && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 ml-2 shadow-sm shadow-primary/20" />
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
