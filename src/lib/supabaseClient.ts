import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('[Supabase] Initializing client with URL:', supabaseUrl);
console.log('[Supabase] Anon key present:', !!supabaseAnonKey);
console.log('[Supabase] Anon key length:', supabaseAnonKey?.length || 0);

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Supabase] Missing environment variables!');
    throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
console.log('[Supabase] Client initialized successfully');
console.log('[Supabase] Client auth methods:', Object.keys(supabase.auth));
