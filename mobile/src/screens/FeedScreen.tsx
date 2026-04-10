import React, { useState } from 'react';
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
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Post {
  id: string;
  content: string;
  tag: string;
  likes: number;
  liked: boolean;
  createdAt: Date;
  replies: Reply[];
}

interface Reply {
  id: string;
  content: string;
  createdAt: Date;
}

const TAGS = ['Confession', 'Rant', 'Tea ☕', 'Career', 'Networking', 'Campus Life', 'Advice Needed', 'Wins'];

// ─── Relative time ────────────────────────────────────────────────────────────

function relTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, onLike, onReply }: { post: Post; onLike: () => void; onReply: () => void }) {
  return (
    <View style={card.container}>
      <View style={card.header}>
        <View style={card.anonAvatar}>
          <Text style={card.anonIcon}>👤</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={card.anon}>Anonymous</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={card.tagBadge}>
              <Text style={card.tagText}>{post.tag}</Text>
            </View>
            <Text style={card.time}>{relTime(post.createdAt)}</Text>
          </View>
        </View>
      </View>
      <Text style={card.content}>{post.content}</Text>
      <View style={card.actions}>
        <TouchableOpacity style={card.actionBtn} onPress={onLike}>
          <Text style={[card.actionText, post.liked && { color: Colors.accent }]}>
            {post.liked ? '❤️' : '🤍'} {post.likes}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={card.actionBtn} onPress={onReply}>
          <Text style={card.actionText}>💬 {post.replies.length} replies</Text>
        </TouchableOpacity>
      </View>
      {post.replies.length > 0 && (
        <View style={card.repliesSection}>
          {post.replies.slice(-2).map(r => (
            <View key={r.id} style={card.replyRow}>
              <Text style={card.replyDot}>·</Text>
              <Text style={card.replyText}>{r.content}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const card = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  anonAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  anonIcon: { fontSize: 16 },
  anon: { color: Colors.subtext, fontSize: 13, fontWeight: '600' },
  tagBadge: {
    backgroundColor: Colors.primary + '22', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  tagText: { color: Colors.primaryLight, fontSize: 11, fontWeight: '700' },
  time: { color: Colors.muted, fontSize: 11 },
  content: { color: Colors.text, fontSize: 15, lineHeight: 22, marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { color: Colors.subtext, fontSize: 13 },
  repliesSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, gap: 6 },
  replyRow: { flexDirection: 'row', gap: 6 },
  replyDot: { color: Colors.muted, fontSize: 16, lineHeight: 20 },
  replyText: { color: Colors.subtext, fontSize: 13, flex: 1, lineHeight: 18 },
});

// ─── Reply Modal ──────────────────────────────────────────────────────────────

function ReplyModal({
  visible,
  post,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  post: Post | null;
  onClose: () => void;
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={rm.overlay}>
        <View style={rm.sheet}>
          <Text style={rm.title}>Reply anonymously</Text>
          {post && <Text style={rm.postPreview} numberOfLines={2}>{post.content}</Text>}
          <TextInput
            style={rm.input}
            value={text}
            onChangeText={setText}
            placeholder="Write your reply..."
            placeholderTextColor={Colors.muted}
            multiline
            maxLength={300}
            autoFocus
          />
          <View style={rm.btns}>
            <TouchableOpacity style={rm.cancel} onPress={() => { setText(''); onClose(); }}>
              <Text style={rm.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rm.send, !text.trim() && { opacity: 0.4 }]}
              disabled={!text.trim()}
              onPress={() => { onSubmit(text.trim()); setText(''); }}
            >
              <Text style={rm.sendText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title: { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 10 },
  postPreview: { color: Colors.subtext, fontSize: 13, marginBottom: 12, fontStyle: 'italic', borderLeftWidth: 2, borderLeftColor: Colors.primary, paddingLeft: 10 },
  input: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 15, minHeight: 80, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 },
  btns: { flexDirection: 'row', gap: 12 },
  cancel: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center' },
  cancelText: { color: Colors.subtext, fontWeight: '600' },
  send: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
  sendText: { color: Colors.white, fontWeight: '700' },
});

// ─── Compose Modal ────────────────────────────────────────────────────────────

function ComposeModal({
  visible,
  onClose,
  onPost,
}: {
  visible: boolean;
  onClose: () => void;
  onPost: (content: string, tag: string) => void;
}) {
  const [text, setText] = useState('');
  const [tag, setTag] = useState(TAGS[0]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={cm.overlay}>
          <View style={cm.sheet}>
            <Text style={cm.title}>Post anonymously</Text>
            <Text style={cm.sub}>No one will know it's you.</Text>
            <TextInput
              style={cm.input}
              value={text}
              onChangeText={setText}
              placeholder="What's on your mind?"
              placeholderTextColor={Colors.muted}
              multiline
              maxLength={500}
              autoFocus
            />
            <Text style={cm.tagLabel}>Tag</Text>
            <View style={cm.tagRow}>
              {TAGS.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[cm.tagChip, tag === t && cm.tagChipActive]}
                  onPress={() => setTag(t)}
                >
                  <Text style={[cm.tagChipText, tag === t && { color: Colors.white }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={cm.btns}>
              <TouchableOpacity style={cm.cancel} onPress={() => { setText(''); onClose(); }}>
                <Text style={cm.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cm.post, !text.trim() && { opacity: 0.4 }]}
                disabled={!text.trim()}
                onPress={() => { onPost(text.trim(), tag); setText(''); setTag(TAGS[0]); }}
              >
                <Text style={cm.postText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  sub: { color: Colors.subtext, fontSize: 13, marginBottom: 14, marginTop: 2 },
  input: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, color: Colors.text, fontSize: 15, minHeight: 100, borderWidth: 1, borderColor: Colors.border, marginBottom: 14 },
  tagLabel: { color: Colors.subtext, fontSize: 12, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  tagChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tagChipText: { color: Colors.subtext, fontSize: 13, fontWeight: '600' },
  btns: { flexDirection: 'row', gap: 12 },
  cancel: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: Colors.surface, alignItems: 'center' },
  cancelText: { color: Colors.subtext, fontWeight: '600' },
  post: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center' },
  postText: { color: Colors.white, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

// Seed data — local-only (no backend needed for now)
const SEED_POSTS: Post[] = [
  {
    id: '1',
    content: "I bombed an interview at Google today. Spent 3 weeks prepping and just blanked on a binary tree question I'd done 20 times. Is this normal?",
    tag: 'Confession',
    likes: 47,
    liked: false,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000),
    replies: [
      { id: 'r1', content: 'Happened to me at Meta. You will get another shot.', createdAt: new Date() },
      { id: 'r2', content: 'Interview anxiety is real. Practice mock interviews out loud next time.', createdAt: new Date() },
    ],
  },
  {
    id: '2',
    content: 'Nobody talks about how lonely networking events actually are. You stand there holding a drink trying to look approachable and everyone is doing the same thing.',
    tag: 'Networking',
    likes: 112,
    liked: false,
    createdAt: new Date(Date.now() - 5 * 3600 * 1000),
    replies: [
      { id: 'r3', content: 'Literally every career fair ever. Just start with "what brought you here today" and it unlocks.', createdAt: new Date() },
    ],
  },
  {
    id: '3',
    content: 'Got my first referral today from someone I met at a random club meeting two months ago. You never know who will come through for you.',
    tag: 'Wins',
    likes: 203,
    liked: false,
    createdAt: new Date(Date.now() - 24 * 3600 * 1000),
    replies: [],
  },
  {
    id: '4',
    content: "Advice needed: how do you follow up with someone from a career fair without sounding desperate? It's been 3 days and I haven't heard back.",
    tag: 'Advice Needed',
    likes: 34,
    liked: false,
    createdAt: new Date(Date.now() - 6 * 3600 * 1000),
    replies: [
      { id: 'r4', content: 'Wait one week then send one short email. Mention something specific you talked about.', createdAt: new Date() },
    ],
  },
  {
    id: '5',
    content: 'Hot take: most networking events on campus are just resume padding. The real connections happen in class, labs, and clubs.',
    tag: 'Tea ☕',
    likes: 89,
    liked: false,
    createdAt: new Date(Date.now() - 48 * 3600 * 1000),
    replies: [],
  },
];

export default function FeedScreen() {
  const [posts, setPosts] = useState<Post[]>(SEED_POSTS);
  const [showCompose, setShowCompose] = useState(false);
  const [replyTarget, setReplyTarget] = useState<Post | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const handlePost = (content: string, tag: string) => {
    const newPost: Post = {
      id: Date.now().toString(),
      content,
      tag,
      likes: 0,
      liked: false,
      createdAt: new Date(),
      replies: [],
    };
    setPosts(prev => [newPost, ...prev]);
    setShowCompose(false);
  };

  const handleLike = (id: string) => {
    setPosts(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  };

  const handleReply = (postId: string, text: string) => {
    const reply: Reply = { id: Date.now().toString(), content: text, createdAt: new Date() };
    setPosts(prev =>
      prev.map(p => p.id === postId ? { ...p, replies: [...p.replies, reply] } : p)
    );
    setReplyTarget(null);
  };

  const filtered = activeTag ? posts.filter(p => p.tag === activeTag) : posts;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.headerRow}>
        <View>
          <Text style={s.heading}>Campus Feed</Text>
          <Text style={s.sub}>Anonymous. Honest. Yours.</Text>
        </View>
        <TouchableOpacity style={s.composeBtn} onPress={() => setShowCompose(true)}>
          <Text style={s.composeBtnText}>+ Post</Text>
        </TouchableOpacity>
      </View>

      {/* Tag filter chips */}
      <View style={{ height: 44 }}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tagBar}
          data={['All', ...TAGS]}
          keyExtractor={t => t}
          renderItem={({ item }) => {
            const active = item === 'All' ? activeTag === null : activeTag === item;
            return (
              <TouchableOpacity
                style={[s.tagChip, active && s.tagChipActive]}
                onPress={() => setActiveTag(item === 'All' ? null : item)}
              >
                <Text style={[s.tagChipText, active && { color: Colors.white }]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={p => p.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onLike={() => handleLike(item.id)}
            onReply={() => setReplyTarget(item)}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>No posts yet in this category.</Text>
          </View>
        }
      />

      <ComposeModal visible={showCompose} onClose={() => setShowCompose(false)} onPost={handlePost} />
      <ReplyModal
        visible={!!replyTarget}
        post={replyTarget}
        onClose={() => setReplyTarget(null)}
        onSubmit={(text) => replyTarget && handleReply(replyTarget.id, text)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8,
  },
  heading: { color: Colors.text, fontSize: 24, fontWeight: '800' },
  sub: { color: Colors.subtext, fontSize: 13, marginTop: 1 },
  composeBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  composeBtnText: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  tagBar: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tagChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  tagChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tagChipText: { color: Colors.subtext, fontSize: 13, fontWeight: '600' },
  list: { padding: 16, paddingTop: 12 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: Colors.subtext, fontSize: 15 },
});
