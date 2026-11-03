'use client';

/**
 * /shop-home/services/enquiries — Enquiry: the customer <-> shop chat, the web
 * counterpart of the Partner app's ShopChatInboxScreen + ShopChatThreadScreen,
 * over the same marketplace-service endpoints (lib/shopChat.js). Laid out like
 * the app's chat screen: contact header with "Last seen …" + call, an
 * "Encrypted via ggfix · Customer chat" pill, day pills, white incoming /
 * green outgoing bubbles with ✓ ticks, and a composer with attach, emoji,
 * camera and a mic / send button.
 *
 * The inbox polls every 7s and pings presence; an open thread polls every 5s,
 * marks itself read and sends a debounced typing ping. ?thread=<id> opens that
 * conversation (the notification bell links here).
 *
 * Attachments (file / camera photo / voice note) upload through the shop's
 * media upload (uploadShopLocationMedia) and are sent as
 * { attachmentUrl, attachmentType: IMAGE | DOCUMENT | AUDIO }.
 *
 * "Encrypted": the backend has no message encryption — only the HTTPS
 * connection is. The pill says exactly that on hover.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  FileText,
  Loader2,
  MessageCircle,
  Mic,
  Paperclip,
  Phone,
  Search,
  SendHorizontal,
  ShieldCheck,
  Smile,
  Square,
  X,
} from 'lucide-react';

import { cx } from '@/components/site/ui';
import ErrorBanner from '@/components/shop-dashboard/ErrorBanner';
import PageHeader from '@/components/shop-dashboard/PageHeader';
import { resolveMediaUrl } from '@/lib/deviceImage';
import { uploadShopLocationMedia } from '@/lib/shopLocations';
import { notifyError } from '@/lib/toast';
import {
  getShopChat,
  getShopChatMessages,
  listShopChats,
  markShopChatRead,
  pingShopPresence,
  pingShopTyping,
  sendShopChatMessage,
} from '@/lib/shopChat';

const INBOX_POLL_MS = 7000;
const THREAD_POLL_MS = 5000;
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#035C6C] focus-visible:ring-offset-2';
const CARD = 'rounded-[22px] border border-[#ECECEC] bg-[#F8F8F8]';
const OUT_BUBBLE = 'bg-[#035C6C] text-white';
const EMOJIS = ['😀', '😊', '😂', '😍', '👍', '🙏', '👌', '🙂', '😉', '😅', '🤝', '👏', '✅', '❤️', '🔧', '📱', '💻', '⌚', '🎧', '📦', '🚚', '⏰', '💰', '❓'];

function clockTime(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function shortTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return clockTime(iso);
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if ((now - d) / 86400000 < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function dayLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date();
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "Online" · "Last seen just now" · "Last seen 18 min ago" · "Last seen 3 hr ago" · "Last seen 2 Oct" */
function lastSeen(online, iso) {
  if (online) return 'Online';
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'Last seen just now';
  if (mins < 60) return `Last seen ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last seen ${hrs} hr ago`;
  return `Last seen ${new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

const initials = (name) => {
  const w = String(name || 'C').trim().split(/\s+/);
  return ((w[0]?.[0] || 'C') + (w[1]?.[0] || '')).toUpperCase();
};
const phoneLabel = (p) => (p ? `+${String(p).replace(/^\+/, '')}` : '');
const fmtDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function Avatar({ url, name, online, size = 'h-11 w-11' }) {
  const [broken, setBroken] = useState(false);
  const src = resolveMediaUrl(url);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  return (
    <span className={cx('relative shrink-0', size)}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar URLs are arbitrary media URLs.
        <img src={src} alt="" onError={() => setBroken(true)} className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-[#E7F7EA] text-[15px] font-bold text-[#024A57]">{initials(name)}</span>
      )}
      {online ? <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[#035C6C]" aria-label="online" /> : null}
    </span>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#111111]/60">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="mt-3 text-[15px] font-bold text-[#111111]">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-[#666666]">{text}</p>
    </div>
  );
}

export default function EnquiriesPage() {
  return (
    <div className="w-full space-y-5">
      <PageHeader title="Enquiry" subtitle="Chat with customers who message your shop from the NearGFix app." />
      <Messages />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inbox + conversation                                                        */
/* -------------------------------------------------------------------------- */

function Messages() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState(null);

  const load = useCallback(async () => {
    pingShopPresence().catch(() => {});
    try {
      const data = await listShopChats();
      setThreads(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('thread');
    if (t) setActiveId(t);
    load();
    const id = setInterval(load, INBOX_POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const totalUnread = threads.reduce((n, t) => n + (t.unreadCount || 0), 0);

  function openThread(id) {
    setActiveId(id);
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    if (id) url.searchParams.set('thread', id);
    else url.searchParams.delete('thread');
    window.history.replaceState(null, '', url);
    if (id) setThreads((prev) => prev.map((t) => (String(t.id) === String(id) ? { ...t, unreadCount: 0 } : t)));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    const digits = q.replace(/\D/g, '');
    return threads.filter(
      (t) =>
        String(t.counterpartName || '').toLowerCase().includes(q) ||
        (digits && String(t.counterpartPhone || '').replace(/\D/g, '').includes(digits)) ||
        String(t.lastMessagePreview || '').toLowerCase().includes(q),
    );
  }, [threads, query]);

  const current = threads.find((t) => String(t.id) === String(activeId)) || null;

  return (
    <div className="flex h-[calc(100dvh-17rem)] min-h-[min(520px,85dvh)] gap-5">
      {/* Inbox */}
      <section className={cx(CARD, 'min-w-0 flex-col overflow-hidden lg:flex lg:w-[380px] lg:shrink-0', activeId ? 'hidden' : 'flex w-full')}>
        <div className="border-b border-[#ECECEC] p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#111111]">
            <MessageCircle className="h-4 w-4 text-[#111111]/70" aria-hidden="true" />
            {loading ? 'Loading…' : `${threads.length} ${threads.length === 1 ? 'chat' : 'chats'}${totalUnread ? ` · ${totalUnread} unread` : ''}`}
          </p>
          <label className="mt-3 flex h-11 items-center gap-2.5 rounded-full border border-[#ECECEC] bg-white px-4 focus-within:border-[#035C6C]">
            <Search className="h-4 w-4 shrink-0 text-[#111111]/60" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, mobile or message"
              aria-label="Search by name, mobile or message"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-sm text-[#111111] outline-none placeholder:text-[#98A2B3]"
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-1 p-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3 rounded-xl p-2">
                  <span className="h-11 w-11 rounded-full bg-white" />
                  <span className="flex-1 space-y-2">
                    <span className="block h-3 w-1/2 rounded bg-white" />
                    <span className="block h-3 w-3/4 rounded bg-white" />
                  </span>
                </div>
              ))}
            </div>
          ) : error && !threads.length ? (
            <div className="p-4">
              <ErrorBanner message={error} onRetry={load} />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title={query ? 'No matches' : 'No customer messages yet'}
              text={query ? 'Try a different name, number or keyword.' : 'When a customer messages your shop, the conversation will appear here.'}
            />
          ) : (
            <ul className="divide-y divide-[#ECECEC]">
              {filtered.map((t) => {
                const unread = t.unreadCount || 0;
                const typing = Boolean(t.counterpartTyping);
                const selected = String(t.id) === String(activeId);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => openThread(t.id)}
                      aria-current={selected ? 'true' : undefined}
                      className={cx('flex w-full items-center gap-3 px-4 py-3 text-left transition', selected ? 'bg-white' : 'hover:bg-white/60')}
                    >
                      <Avatar url={t.counterpartAvatarUrl} name={t.counterpartName} online={t.counterpartOnline} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-[#111111]">{t.counterpartName || 'Customer'}</span>
                          <span className={cx('shrink-0 text-[11px] font-medium', unread ? 'text-[#035C6C]' : 'text-[#98A2B3]')}>{shortTime(t.lastMessageAt)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className={cx('min-w-0 flex-1 truncate text-[13px]', typing ? 'italic text-[#035C6C]' : unread ? 'font-semibold text-[#111111]' : 'text-[#666666]')}>
                            {typing ? 'typing…' : t.lastMessagePreview || 'Tap to start the conversation'}
                          </span>
                          {unread ? (
                            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#035C6C] px-1.5 text-[10.5px] font-bold text-white">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          ) : null}
                        </span>
                        {t.counterpartPhone ? <span className="mt-0.5 block truncate text-[11.5px] text-[#98A2B3]">{phoneLabel(t.counterpartPhone)}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* Conversation */}
      <section className={cx(CARD, 'min-w-0 flex-1 flex-col overflow-hidden', activeId ? 'flex' : 'hidden lg:flex')}>
        {activeId ? (
          <ChatThread key={activeId} threadId={activeId} summary={current} onBack={() => openThread(null)} onSent={load} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#111111]/50">
              <MessageCircle className="h-7 w-7" aria-hidden="true" />
            </span>
            <p className="mt-3 text-[14px] font-medium text-[#666666]">{threads.length ? 'Select a conversation to read it here.' : 'Conversations will open here.'}</p>
          </div>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Thread                                                                      */
/* -------------------------------------------------------------------------- */

function ChatThread({ threadId, summary, onBack, onSent }) {
  const [head, setHead] = useState(summary || null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const typingRef = useRef({ on: false, timer: null });
  const countRef = useRef(0);
  const recRef = useRef({ recorder: null, chunks: [], stream: null, timer: null, cancelled: false });

  const refresh = useCallback(async () => {
    try {
      const [h, msgs] = await Promise.all([getShopChat(threadId).catch(() => null), getShopChatMessages(threadId)]);
      if (h) setHead(h);
      setMessages(msgs);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load this conversation.');
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    refresh();
    markShopChatRead(threadId).catch(() => {});
    const id = setInterval(() => {
      refresh();
      markShopChatRead(threadId).catch(() => {});
    }, THREAD_POLL_MS);
    const typing = typingRef.current;
    const rec = recRef.current;
    return () => {
      clearInterval(id);
      clearTimeout(typing.timer);
      if (typing.on) pingShopTyping(threadId, false).catch(() => {});
      // stop any voice recording still running when the thread closes
      rec.cancelled = true;
      clearInterval(rec.timer);
      if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop();
      rec.stream?.getTracks().forEach((t) => t.stop());
    };
  }, [threadId, refresh]);

  // Stick to the bottom when new messages arrive.
  useEffect(() => {
    if (messages.length !== countRef.current) {
      endRef.current?.scrollIntoView({ block: 'end', behavior: countRef.current ? 'smooth' : 'auto' });
      countRef.current = messages.length;
    }
  }, [messages]);

  function onType(value) {
    setText(value);
    const t = typingRef.current;
    if (!t.on && value) {
      t.on = true;
      pingShopTyping(threadId, true).catch(() => {});
    }
    clearTimeout(t.timer);
    t.timer = setTimeout(() => {
      if (t.on) {
        t.on = false;
        pingShopTyping(threadId, false).catch(() => {});
      }
    }, 2500);
  }

  async function deliver(payload) {
    setSending(true);
    try {
      const sent = await sendShopChatMessage(threadId, payload);
      if (sent?.id) setMessages((prev) => [...prev, sent]);
      else refresh();
      onSent?.();
      return true;
    } catch (err) {
      notifyError(err, 'Message not sent. Try again.');
      return false;
    } finally {
      setSending(false);
    }
  }

  async function send(e) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    if (await deliver({ body })) setText('');
  }

  async function sendFile(file, type) {
    if (!file || sending) return;
    setSending(true);
    try {
      const isPdf = file.type === 'application/pdf';
      const url = await uploadShopLocationMedia(file, 'chat-attachments', { document: isPdf });
      if (!url) throw new Error('Upload failed — no file URL was returned.');
      const attachmentType = type || (file.type.startsWith('image/') ? 'IMAGE' : file.type.startsWith('audio/') ? 'AUDIO' : 'DOCUMENT');
      setSending(false);
      await deliver({ body: text.trim() || undefined, attachmentUrl: url, attachmentType });
      setText('');
    } catch (err) {
      notifyError(err, 'Could not send the attachment.');
      setSending(false);
    }
  }

  async function startRecording() {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      notifyError('Voice notes are not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new window.MediaRecorder(stream);
      const rec = recRef.current;
      Object.assign(rec, { recorder, stream, chunks: [], cancelled: false });
      recorder.ondataavailable = (ev) => ev.data?.size && rec.chunks.push(ev.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(rec.timer);
        setRecording(false);
        if (rec.cancelled || !rec.chunks.length) return;
        const blob = new Blob(rec.chunks, { type: recorder.mimeType || 'audio/webm' });
        const ext = (recorder.mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm';
        sendFile(new File([blob], `voice-note.${ext}`, { type: blob.type }), 'AUDIO');
      };
      recorder.start();
      setRecordSecs(0);
      setRecording(true);
      rec.timer = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      notifyError('Microphone access was denied or is unavailable.');
    }
  }

  function stopRecording(cancel = false) {
    const rec = recRef.current;
    rec.cancelled = cancel;
    if (rec.recorder && rec.recorder.state !== 'inactive') rec.recorder.stop();
  }

  function addEmoji(emoji) {
    onType(`${text}${emoji}`);
    setEmojiOpen(false);
    inputRef.current?.focus();
  }

  const name = head?.counterpartName || 'Customer';
  const status = head?.counterpartTyping ? 'typing…' : lastSeen(head?.counterpartOnline, head?.counterpartLastSeenAt);
  const hasText = Boolean(text.trim());
  const iconBtn = cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#666666] transition hover:bg-[#F3F3F3] hover:text-[#111111] disabled:opacity-40', FOCUS_RING);

  return (
    <>
      {/* Contact header */}
      <div className="flex items-center gap-3 border-b border-[#ECECEC] bg-white px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chats"
          className={cx('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3F3F3] text-[#111111] transition hover:bg-[#ECECEC] lg:hidden', FOCUS_RING)}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <Avatar url={head?.counterpartAvatarUrl} name={name} online={head?.counterpartOnline} size="h-12 w-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-bold text-[#111111]">{name}</p>
          <p className={cx('truncate text-[13px]', head?.counterpartTyping ? 'italic text-[#035C6C]' : 'text-[#666666]')}>{status || phoneLabel(head?.counterpartPhone) || ' '}</p>
        </div>
        {head?.counterpartPhone ? (
          <a
            href={`tel:${String(head.counterpartPhone).replace(/[^\d+]/g, '')}`}
            aria-label={`Call ${name}`}
            title={phoneLabel(head.counterpartPhone)}
            className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E7F7EA] text-[#035C6C] transition hover:bg-[#DCF3E1]', FOCUS_RING)}
          >
            <Phone className="h-5 w-5" aria-hidden="true" />
          </a>
        ) : null}
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#F3F3F3] px-3 py-4 sm:px-6">
        <p className="mb-3 text-center">
          <span
            title="Messages travel over an encrypted HTTPS connection. They are not end-to-end encrypted."
            className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-[#ECECEC] bg-white px-3.5 py-1.5 text-[12.5px] text-[#666666]"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#035C6C]" aria-hidden="true" />
            Encrypted via ggfix · Customer chat
          </span>
        </p>
        {loading ? (
          <div className="flex justify-center pt-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#035C6C]" aria-hidden="true" />
          </div>
        ) : error && !messages.length ? (
          <ErrorBanner message={error} onRetry={refresh} />
        ) : messages.length === 0 ? (
          <p className="pt-10 text-center text-[13px] text-[#98A2B3]">No messages yet — say hello.</p>
        ) : (
          <div className="space-y-2">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString();
              return (
                <div key={m.id || i}>
                  {newDay && m.createdAt ? (
                    <p className="my-4 text-center">
                      <span className="rounded-full border border-[#ECECEC] bg-white px-3.5 py-1 text-[12px] font-semibold text-[#666666]">{dayLabel(m.createdAt)}</span>
                    </p>
                  ) : null}
                  <Bubble m={m} />
                </div>
              );
            })}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form onSubmit={send} className="relative border-t border-[#ECECEC] bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
        {emojiOpen ? (
          <div className="absolute bottom-full left-3 z-20 mb-2 grid w-[264px] grid-cols-8 gap-1 rounded-2xl border border-[#ECECEC] bg-white p-2 shadow-[0_10px_30px_rgba(17,17,17,0.12)]">
            {EMOJIS.map((em) => (
              <button key={em} type="button" onClick={() => addEmoji(em)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] hover:bg-[#F3F3F3]">
                {em}
              </button>
            ))}
          </div>
        ) : null}

        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { sendFile(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { sendFile(e.target.files?.[0], 'IMAGE'); e.target.value = ''; }} />

        <div className="flex items-center gap-2">
          {recording ? (
            <div className="flex h-[52px] min-w-0 flex-1 items-center gap-3 rounded-full border border-[#F84141]/30 bg-[#FEF3F2] px-4">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#F84141]" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#111111]">Recording… {fmtDuration(recordSecs)}</span>
              <button type="button" onClick={() => stopRecording(true)} aria-label="Cancel voice note" className={iconBtn}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="flex h-[52px] min-w-0 flex-1 items-center gap-1 rounded-full border border-[#ECECEC] bg-white pl-2 pr-2 focus-within:border-[#035C6C]">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={sending} aria-label="Attach a file" title="Attach photo or PDF" className={iconBtn}>
                <Paperclip className="h-5 w-5" aria-hidden="true" />
              </button>
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) send(e);
                }}
                placeholder="Type a message..."
                aria-label="Type a message"
                className="min-w-0 flex-1 bg-transparent px-1 text-[15px] text-[#111111] outline-none placeholder:text-[#98A2B3]"
              />
              <button type="button" onClick={() => setEmojiOpen((v) => !v)} aria-label="Emoji" aria-expanded={emojiOpen} className={iconBtn}>
                <Smile className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => cameraRef.current?.click()} disabled={sending} aria-label="Take a photo" title="Camera" className={iconBtn}>
                <Camera className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Send when there's text; otherwise mic (start / stop a voice note) */}
          <button
            type={hasText ? 'submit' : 'button'}
            onClick={hasText ? undefined : () => (recording ? stopRecording(false) : startRecording())}
            disabled={sending}
            aria-label={hasText ? 'Send' : recording ? 'Stop and send voice note' : 'Record a voice note'}
            className={cx(
              'flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[#F3BF23] text-[#1E1E1E] transition hover:bg-[#E5B11A] disabled:cursor-not-allowed disabled:opacity-50',
              FOCUS_RING,
            )}
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : hasText ? (
              <SendHorizontal className="h-5 w-5" aria-hidden="true" />
            ) : recording ? (
              <Square className="h-4 w-4 fill-current" aria-hidden="true" />
            ) : (
              <Mic className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </form>
    </>
  );
}

function Bubble({ m }) {
  const sender = String(m.sender || '').toUpperCase();
  if (sender === 'SYSTEM') {
    return <p className="my-2 text-center text-[12px] italic text-[#666666]">{m.body}</p>;
  }
  const mine = sender === 'SHOP';
  const url = resolveMediaUrl(m.attachmentUrl) || m.attachmentUrl;
  const type = String(m.attachmentType || '').toUpperCase();
  const Tick = m.read ? CheckCheck : Check;
  return (
    <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cx(
          'max-w-[82%] rounded-[22px] px-4 py-2.5 text-[15px] sm:max-w-[60%]',
          mine ? cx(OUT_BUBBLE, 'rounded-br-md') : 'rounded-bl-md border border-[#ECECEC] bg-white text-[#111111]',
        )}
      >
        {url && type === 'IMAGE' ? (
          <a href={url} target="_blank" rel="noreferrer" className="mb-1.5 block overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- chat attachments are arbitrary media URLs. */}
            <img src={url} alt="Attachment" className="max-h-72 w-full object-cover" />
          </a>
        ) : null}
        {url && type === 'AUDIO' ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- voice note, no captions available.
          <audio controls src={url} className="mb-1 max-w-full" />
        ) : null}
        {url && type !== 'IMAGE' && type !== 'AUDIO' ? (
          <a href={url} target="_blank" rel="noreferrer" className={cx('mb-1 flex items-center gap-1.5 font-semibold underline', mine ? 'text-white' : 'text-[#035C6C]')}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            Attachment
          </a>
        ) : null}
        {m.body ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
        <p className={cx('mt-1 flex items-center justify-end gap-1 text-[12px]', mine ? 'text-white/85' : 'text-[#666666]')}>
          {m.createdAt ? clockTime(m.createdAt) : ''}
          {mine ? <Tick className="h-3.5 w-3.5" aria-label={m.read ? 'Read' : 'Sent'} /> : null}
        </p>
      </div>
    </div>
  );
}
