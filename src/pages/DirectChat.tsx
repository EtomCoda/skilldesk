import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';

interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

interface Participant {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}


export default function DirectChat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const currentUser = useStore((state) => state.currentUser);

  const [otherUser, setOtherUser] = useState<Participant | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatRequest, setChatRequest] = useState<{ job_title: string; budget: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId && currentUser) {
      fetchConversation();
      const interval = setInterval(fetchMessages, 2000);
      return () => clearInterval(interval);
    }
  }, [conversationId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversation = async () => {
    try {
      const { data: conv } = await supabase
        .from('direct_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (!conv) {
        navigate(-1);
        return;
      }


      // Figure out the other participant
      const otherUserId = conv.participant_a === currentUser?.id ? conv.participant_b : conv.participant_a;

      const { data: userData } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url')
        .eq('id', otherUserId)
        .single();

      setOtherUser(userData);

      // Load the originating chat request context if any
      if (conv.chat_request_id) {
        const { data: reqData } = await supabase
          .from('chat_requests')
          .select('job_title, budget')
          .eq('id', conv.chat_request_id)
          .single();
        setChatRequest(reqData);
      }

      await fetchMessages();
    } catch (err) {
      console.error('Error fetching conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (data) setMessages(data);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !conversationId) return;

    setSending(true);
    try {
      const { error } = await supabase.from('direct_messages').insert({
        conversation_id: conversationId,
        sender_id: currentUser.id,
        message: newMessage.trim(),
      });

      if (error) throw error;
      setNewMessage('');
      await fetchMessages();
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: DirectMessage[] }[] = [];
  messages.forEach((msg) => {
    const dateLabel = formatDate(msg.created_at);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.date === dateLabel) {
      lastGroup.messages.push(msg);
    } else {
      groupedMessages.push({ date: dateLabel, messages: [msg] });
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b shadow-sm px-4 py-3 flex items-center gap-4 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-blue-700 font-bold">
            {otherUser?.full_name?.charAt(0) || '?'}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{otherUser?.full_name || 'Unknown'}</p>
          {chatRequest && (
            <p className="text-xs text-gray-500 truncate">
              Re: {chatRequest.job_title} · ₦{chatRequest.budget.toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-green-600">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-xs font-medium">Direct Chat</span>
        </div>
      </div>

      {/* Context banner if from chat request */}
      {chatRequest && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Job inquiry:</span> {chatRequest.job_title} · Budget ₦{chatRequest.budget.toLocaleString()}
          </p>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-blue-300" />
            </div>
            <p className="text-gray-500 font-medium">Start the conversation!</p>
            <p className="text-gray-400 text-sm mt-1">
              Say hello to {otherUser?.full_name?.split(' ')[0]}
            </p>
          </div>
        )}

        {groupedMessages.map(({ date, messages: dayMessages }) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex items-center gap-3 my-3">
              <div className="flex-1 border-t border-gray-200" />
              <span className="text-xs text-gray-400 font-medium px-2">{date}</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {dayMessages.map((msg) => {
              const isMe = msg.sender_id === currentUser?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && (
                    <div className="w-7 h-7 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                      <span className="text-blue-700 font-bold text-xs">
                        {otherUser?.full_name?.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? 'bg-blue-950 text-white rounded-br-md'
                          : 'bg-white text-gray-900 shadow-sm border border-gray-100 rounded-bl-md'
                      }`}
                    >
                      {msg.message}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 px-1">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border-t px-4 py-3 sticky bottom-0">
        <form onSubmit={handleSend} className="flex gap-3 items-end">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${otherUser?.full_name?.split(' ')[0] || ''}...`}
            className="flex-1 px-4 py-3 bg-gray-100 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none text-sm"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="w-11 h-11 bg-blue-950 text-white rounded-xl flex items-center justify-center hover:bg-blue-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
