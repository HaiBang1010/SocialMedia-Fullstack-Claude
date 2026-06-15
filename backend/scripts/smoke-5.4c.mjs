// Phase 5.4c smoke — emoji derive, sticker/GIF, post-share gate, parity, SetNull, Giphy proxy.
// Run with the dev server up: node scripts/smoke-5.4c.mjs
const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch { /* 204 */ }
  return { status: res.status, data };
}

async function makeUser(tag) {
  const u = `u${tag}${Date.now().toString().slice(-7)}`.toLowerCase();
  await api('POST', '/auth/register', null, { username: u, email: `${u}@t.io`, password: 'password123', name: u });
  const login = await api('POST', '/auth/login', null, { identifier: u, password: 'password123' });
  return { token: login.data.accessToken, id: login.data.user.id, username: u };
}

const sticker = (order = 0) => ({ type: 'STICKER', order, url: 'https://media.giphy.com/media/abc/giphy.gif', width: 200, height: 200 });
const gif = (order = 0) => ({ type: 'GIF', order, url: 'https://media.giphy.com/media/def/giphy.gif', width: 320, height: 240 });

(async () => {
  console.log('Setup');
  const A = await makeUser('a'), B = await makeUser('b');
  ok(A.token && B.token, 'register + login A & B');
  const post = await api('POST', '/posts', A.token, { caption: 'shareable post' });
  ok(post.status === 201 && post.data.id, 'A creates caption-only post');
  const postId = post.data.id;
  const conv = await api('POST', '/conversations/direct', A.token, { targetUserId: B.id });
  ok(conv.status === 201 && conv.data.id, 'A↔B direct conversation');
  const cid = conv.data.id;
  const send = (body) => api('POST', `/conversations/${cid}/messages`, A.token, body);

  console.log('Emoji derive');
  ok((await send({ content: '😂' })).data.contentType === 'EMOJI', '"😂" → EMOJI');
  ok((await send({ content: '😂🔥' })).data.contentType === 'EMOJI', '"😂🔥" → EMOJI');
  ok((await send({ content: '😂 lol' })).data.contentType === 'TEXT', '"😂 lol" → TEXT');
  ok((await send({ content: '😀😀😀😀' })).data.contentType === 'TEXT', '4 emoji → TEXT');
  ok((await send({ content: 'hello' })).data.contentType === 'TEXT', 'plain text → TEXT');

  console.log('Sticker / GIF');
  const st = await send({ media: [sticker()] });
  ok(st.status === 201 && st.data.contentType === 'STICKER', 'sticker → 201 STICKER');
  ok(st.data.media[0] && !('objectKey' in st.data.media[0]), 'sticker media: objectKey NOT leaked');
  ok(st.data.media[0]?.url?.includes('giphy'), 'sticker url preserved');
  ok((await send({ media: [gif()] })).data.contentType === 'GIF', 'gif → 201 GIF');

  console.log('Post share');
  const shared = await send({ sharedPostId: postId });
  ok(shared.status === 201 && shared.data.contentType === 'POST_SHARE', 'sharedPostId → 201 POST_SHARE');
  ok(shared.data.sharedPost?.id === postId, 'sharedPost.id matches');
  ok(shared.data.sharedPost?.author?.username === A.username, 'sharedPost.author present');
  ok(shared.data.sharedPost?.firstMedia === null, 'sharedPost.firstMedia null (caption-only post)');
  ok(!('email' in (shared.data.sharedPost?.author ?? {})), 'sharedPost.author: no email leak');
  const sharedCap = await send({ sharedPostId: postId, content: 'check this 👀' });
  ok(sharedCap.status === 201 && sharedCap.data.content === 'check this 👀', 'post-share + caption OK (E2)');

  console.log('Validation gates');
  ok((await send({ sharedPostId: 'cjld2cjxh0000qzrmn831i7rn' })).status === 404, 'sharedPostId nonexistent → 404');
  ok((await send({ sharedPostId: postId, media: [sticker()] })).status === 400, 'sharedPost + media → 400');
  ok((await send({ media: [sticker()], content: 'hi' })).status === 400, 'sticker + caption → 400');
  ok((await send({ media: [sticker(0), sticker(1)] })).status === 400, '2 stickers → 400');
  ok((await send({})).status === 400, 'empty message → 400');

  // B can't share A's post if it were private — here PUBLIC so B CAN share it (sender gate).
  const bShare = await api('POST', `/conversations/${cid}/messages`, B.token, { sharedPostId: postId });
  ok(bShare.status === 201, 'B shares A\'s PUBLIC post → 201 (viewable by sender)');

  console.log('Giphy proxy');
  ok((await api('GET', '/giphy/search?q=', A.token)).status === 400, 'search empty q → 400');
  ok((await api('GET', '/giphy/trending?type=gif', null)).status === 401, 'giphy no token → 401');
  const trend = await api('GET', '/giphy/trending?type=gif&limit=5', A.token);
  ok([200, 503].includes(trend.status), `giphy trending → ${trend.status} (200 ok / 503 if key/network down)`);
  if (trend.status === 200) ok(Array.isArray(trend.data.items), 'giphy trending returns items[]');
  const search = await api('GET', '/giphy/search?q=cat&type=stickers&limit=5', A.token);
  ok([200, 503].includes(search.status), `giphy search stickers → ${search.status}`);

  console.log('Parity + SetNull');
  const list = await api('GET', '/conversations', A.token);
  const lm = list.data.conversations?.[0]?.lastMessage;
  ok(lm && 'sharedPost' in lm && 'media' in lm && 'reactions' in lm, 'conversation lastMessage carries sharedPost/media/reactions (parity)');
  // Delete the shared post → the POST_SHARE message's sharedPost becomes null (FK SetNull).
  ok((await api('DELETE', `/posts/${postId}`, A.token)).status === 204, 'A deletes shared post → 204');
  const after = await api('GET', `/conversations/${cid}/messages`, A.token);
  const shareMsg = after.data.messages.find((m) => m.id === shared.data.id);
  ok(shareMsg && shareMsg.sharedPost === null, 'after delete: POST_SHARE message sharedPost = null (SetNull)');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
