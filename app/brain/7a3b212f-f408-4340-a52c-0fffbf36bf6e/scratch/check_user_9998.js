
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', 9998)
    .single();
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('User 9998 data:', JSON.stringify(data, null, 2));
  }
}

checkUser();
