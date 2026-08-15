import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zyhntpadiipxxeaylxvd.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_R4EnCHsjI4bu44aUgoe8Dw_cg99ykBg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
