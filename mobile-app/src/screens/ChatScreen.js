/**
 * 💬 CHAT SCREEN
 * Chat temps réel entre un agent et son responsable.
 *
 * Route params : { conversationId?, recipientId, recipientName, recipientPhoto? }
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { messagesAPI } from '../services/api';
import socketService from '../services/socketService';
import useAuthStore from '../services/authStore';
import soundEffects from '../utils/soundEffects';

// ──────────────────────────────────────────────────────────────────────────────

const BUBBLE_SENT     = '#2563eb';
const BUBBLE_RECEIVED = '#f3f4f6';
const TEXT_SENT       = '#ffffff';
const TEXT_RECEIVED   = '#111827';

// ──────────────────────────────────────────────────────────────────────────────

const Avatar = ({ name, photo, size = 36 }) => {
  const initials = (name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (photo) {
    return <Image source={{ uri: photo }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
};

// ──────────────────────────────────────────────────────────────────────────────

const MessageBubble = ({ message, isMe }) => {
  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowOther]}>
      {!isMe && (
        <Avatar
          name={`${message.sender?.firstName || ''} ${message.sender?.lastName || ''}`}
          photo={message.sender?.profilePhoto}
          size={30}
        />
      )}
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
        {!isMe && message.sender && (
          <Text style={styles.bubbleSenderName}>
            {message.sender.firstName} {message.sender.lastName}
          </Text>
        )}
        <Text style={[styles.bubbleText, { color: isMe ? TEXT_SENT : TEXT_RECEIVED }]}>
          {message.content}
        </Text>
        <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.6)' : '#9ca3af' }]}>
          {time}
        </Text>
      </View>
    </View>
  );
};

// ──────────────────────────────────────────────────────────────────────────────

export default function ChatScreen({ navigation, route }) {
  const { user }       = useAuthStore();
  const {
    conversationId: paramConvId,
    recipientId,
    recipientName,
    recipientPhoto,
  } = route.params || {};

  const [conversationId, setConversationId] = useState(paramConvId || null);
  const [messages, setMessages]   = useState([]);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const flatListRef               = useRef(null);

  // ── Initialiser / charger conversation ────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      let convId = conversationId;

      if (!convId && recipientId) {
        const res = await messagesAPI.getOrCreateDirect(recipientId);
        convId = res.data.data.conversation.id;
        setConversationId(convId);
      }

      if (convId) {
        const res = await messagesAPI.getMessages(convId);
        setMessages(res.data.data.messages || []);
      }
    } catch (err) {
      console.error('ChatScreen loadData:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, recipientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Socket.IO — réception temps réel ──────────────────────────────────────
  useEffect(() => {
    const handleNew = (data) => {
      if (data.conversationId === conversationId || !conversationId) {
        setMessages(prev => {
          // Éviter les doublons
          if (prev.find(m => m.id === data.message?.id)) return prev;
          return [...prev, data.message];
        });
        soundEffects.playMessage(); // 🔔 son réception message
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };

    socketService.on('chat:new_message',   handleNew);
    socketService.on('chat:message_sent',  handleNew);
    socketService.on('message:new',        handleNew);

    return () => {
      socketService.off('chat:new_message',   handleNew);
      socketService.off('chat:message_sent',  handleNew);
      socketService.off('message:new',        handleNew);
    };
  }, [conversationId]);

  // ── Auto-scroll au dernier message ────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
    }
  }, [messages.length]);

  // ── Envoi de message ───────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setText('');

    try {
      let convId = conversationId;

      if (!convId && recipientId) {
        const res = await messagesAPI.getOrCreateDirect(recipientId);
        convId = res.data.data.conversation.id;
        setConversationId(convId);
      }

      if (convId) {
        // Envoi via REST API (sauvegarde DB + emit socket par le backend)
        const res = await messagesAPI.sendMessage({ conversationId: convId, content: trimmed });
        const sent = res.data.data;
        soundEffects.playButtonPress(); // 🔔 son envoi message
        setMessages(prev => {
          if (prev.find(m => m.id === sent.id)) return prev;
          return [...prev, sent];
        });
      } else if (recipientId) {
        // Fallback : envoi via socket directement
        socketService.emit('chat:send_message', {
          recipientId,
          content: trimmed,
        });
      }
    } catch (err) {
      console.error('ChatScreen handleSend:', err);
      setText(trimmed); // Restaurer le texte si erreur
    } finally {
      setSending(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1f2937" />
        </TouchableOpacity>
        <Avatar name={recipientName} photo={recipientPhoto} size={38} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{recipientName || 'Chat'}</Text>
          <Text style={styles.headerSub}>Responsable · Temps réel</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Messages list */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="chatbubble-ellipses-outline" size={56} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Commencez la conversation</Text>
            <Text style={styles.emptySubtitle}>
              Envoyez un message à {recipientName || 'votre responsable'}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item, idx) => item.id?.toString() || idx.toString()}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isMe={item.senderId === user?.id}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Écrire un message..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={500}
              returnKeyType="default"
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#fff' },
  flex:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700', color: '#1f2937' },
  headerSub:  { fontSize: 12, color: '#6b7280', marginTop: 1 },

  // Avatar
  avatar:         { resizeMode: 'cover' },
  avatarFallback: { backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '700' },

  // Messages
  listContent: { padding: 16, paddingBottom: 8, gap: 6 },

  bubbleRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 3 },
  bubbleRowMe:    { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '75%',
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  bubbleMe: {
    backgroundColor: BUBBLE_SENT,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: BUBBLE_RECEIVED,
    borderBottomLeftRadius: 4,
  },

  bubbleSenderName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    marginBottom: 3,
  },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },

  // Empty
  emptyTitle:    { fontSize: 17, fontWeight: '600', color: '#374151', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: '#9ca3af', marginTop: 6, textAlign: 'center' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  inputWrap: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 120,
  },
  input: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 20,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BUBBLE_SENT,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  sendBtnDisabled: { backgroundColor: '#d1d5db', elevation: 0, shadowOpacity: 0 },
});
