import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (import.meta.env.DEV) {
    console.log('[Supabase] Initializing client with URL:', supabaseUrl);
    console.log('[Supabase] Anon key present:', !!supabaseAnonKey);
}

if (!supabaseUrl || !supabaseAnonKey) {
    if (import.meta.env.DEV) {
        console.error('[Supabase] Missing environment variables!');
    }
    throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'supabase.auth.token',
  }
});

if (import.meta.env.DEV) {
    console.log('[Supabase] Client initialized successfully');
}

