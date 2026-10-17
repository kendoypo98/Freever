import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY; // public by design; row level security protects the data

export const configured = !!(url && key);
export const supabase = configured ? createClient(url, key) : null;
