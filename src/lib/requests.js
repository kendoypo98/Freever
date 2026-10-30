import { reactive, computed } from 'vue';
import { supabase } from './supabase.js';
import { requestEntries } from './requestPlan.js';

const SQL_HINT = 'Run supabase/migrations/007_requests.sql in the Supabase SQL editor to turn on in-app requests.';

export const inbox = reactive({ received: [], sent: [], loaded: false, error: '' });
export const pendingCount = computed(() => inbox.received.filter((r) => r.status === 'pending').length);

export async function refreshInbox(userId) {
  if (!supabase || !userId || !navigator.onLine) return;
  const { data, error } = await supabase.from('reliever_requests').select('*').order('created_at', { ascending: false }).limit(150);
  if (error) { inbox.error = /relation|does not exist|schema cache/i.test(error.message) ? SQL_HINT : error.message; inbox.loaded = true; return; }
  inbox.error = '';
  inbox.received = data.filter((r) => r.reliever_id === userId);
  inbox.sent = data.filter((r) => r.requester_id === userId);
  inbox.loaded = true;
}

export function clearInbox() { Object.assign(inbox, { received: [], sent: [], loaded: false, error: '' }); }

async function rpc(name, args) {
  let res;
  try { res = await supabase.rpc(name, args); }
  catch { throw new Error('You are offline. Requests need a connection: copy the message and send it in Messenger.'); }
  const { data, error } = res;
  if (error && /failed to fetch|load failed|network/i.test(error.message)) throw new Error('You are offline. Requests need a connection: copy the message and send it in Messenger.');
  if (error) throw new Error(/function .* does not exist|schema cache/i.test(error.message) ? SQL_HINT : error.message);
  return data;
}

export const sendRequests = (plan) => rpc('send_requests', { entries: requestEntries(plan) });
/** "Please take my duty for a while": one break request to someone who is on duty at the same time. */
export const sendBreak = ({ name, day, date, start, end }) =>
  rpc('send_requests', { entries: [{ reliever_name: name, day, on_date: date, lab: '', start_min: start, end_min: end, kind: 'break' }] });
export const respond = (id, accept) => rpc('respond_request', { request_id: id, accept });
export const cancel = (id) => rpc('cancel_request', { request_id: id });
