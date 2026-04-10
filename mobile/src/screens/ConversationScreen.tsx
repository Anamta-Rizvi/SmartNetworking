import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors } from '../constants/colors';
import { useStore } from '../store/useStore';
import { getMessages, sendMessage, DirectMessage } from '../api/chat';

export default function ConversationScreen() {
  const { userId } = useStore();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const qc = useQueryClient();
  const { peerId, peerName } = route.params as { peerId: number; peerName: string };
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', userId, peerId],
    queryFn: () => getMessages(userId!, peerId),
    refetchInterval: 5000,
  });

  useEffect(() => {
    navigation.setOptions({ title: peerName });
  }, [peerName]);

  useEffect(() => {
    if (messages.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      sendMessage({ sender_id: userId!, receiver_id: peerId, content }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['messages', userId, peerId] });
      qc.invalidateQueries({ queryKey: ['conversations', userId] });
    },
  });

  const renderMessage = ({ item }: { item: DirectMessage }) => {
    const isMine = item.sender_id === userId;
    return (
      <View style={[bubble.wrapper, isMine ? bubble.right : bubble.left]}>
        <View style={[bubble.bubble, isMine ? bubble.mine : bubble.theirs]}>
          <Text style={[bubble.text, isMine ? bubble.textMine : bubble.textTheirs]}>
            {item.content}
          </Text>
          {item.is_ai_generated && (
            <Text style={bubble.aiTag}>✦ AI drafted</Text>
          )}
        </View>
        <Text style={bubble.time}>
          {new Date(item.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessage}
            contentContainerStyle={s.list}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyText}>No messages yet. Say hi!</Text>
              </View>
            }
          />
        )}

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!text.trim() || sendMutation.isPending) && { opacity: 0.4 }]}
            disabled={!text.trim() || sendMutation.isPending}
            onPress={() => sendMutation.mutate(text.trim())}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={s.sendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const bubble = StyleSheet.create({
  wrapper: { marginVertical: 4, maxWidth: '80%' },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: Colors.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.border },
  text: { fontSize: 15, lineHeight: 20 },
  textMine: { color: Colors.white },
  textTheirs: { color: Colors.text },
  aiTag: { color: Colors.primaryLight, fontSize: 10, marginTop: 4, opacity: 0.8 },
  time: { color: Colors.muted, fontSize: 10, marginTop: 2, paddingHorizontal: 4 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, paddingBottom: 8 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: Colors.subtext, fontSize: 15 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendText: { color: Colors.white, fontWeight: '700', fontSize: 15 },
});
