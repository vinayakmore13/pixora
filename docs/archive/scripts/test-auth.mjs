import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  console.log('Testing auth.signInWithPassword...');
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'fakepassword123'
  });
  console.log('Sign In:', { data, error });
}

test();
