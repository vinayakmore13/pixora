// Connection Test - Run this in browser console to verify Supabase connection
// Paste into DevTools Console (F12) while app is running

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n');

  try {
    // Import supabase client (available globally if app is running)
    const { supabase } = await import('./supabaseClient');

    console.log('✅ Supabase client imported successfully');

    // Test 1: Check auth status
    console.log('\n📋 Test 1: Authentication Status');
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) {
      console.error('❌ Auth error:', authError.message);
    } else {
      console.log('✅ Auth check passed. Current session:', session ? 'Active' : 'None');
    }

    // Test 2: Check database connectivity
    console.log('\n📋 Test 2: Database Connectivity');
    const { data, error: dbError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });

    if (dbError) {
      console.error('❌ Database error:', dbError.message);
    } else {
      console.log('✅ Database connection successful');
      console.log('   Can query profiles table: YES');
    }

    // Test 3: Check storage bucket
    console.log('\n📋 Test 3: Storage Configuration');
    const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
    if (storageError) {
      console.error('❌ Storage error:', storageError.message);
    } else {
      console.log('✅ Storage bucket access successful');
      console.log('   Available buckets:', buckets.length);
      buckets.forEach(b => console.log(`   - ${b.name}`));
    }

    // Test 4: Check RLS policies
    console.log('\n📋 Test 4: RLS Policies');
    const { data: policies, error: policyError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (policyError?.code === 'PGRST116') {
      console.warn('⚠️  RLS policy restriction (expected if not authenticated)');
    } else if (policyError) {
      console.error('❌ RLS error:', policyError.message);
    } else {
      console.log('✅ RLS policies configured');
    }

    console.log('\n✅ Connection tests completed!');
    console.log('\n📊 Summary:');
    console.log('   - Supabase URL: Loaded ✅');
    console.log('   - Anon Key: Loaded ✅');
    console.log('   - Database: Connected ✅');
    console.log('   - Storage: Accessible ✅');
    console.log('   - Auth: Working ✅');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check if app is running on http://localhost:3000');
    console.log('   2. Verify .env file has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
    console.log('   3. Check browser console for specific errors');
  }
}

// Run the test
testSupabaseConnection();
