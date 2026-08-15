import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zyhntpadiipxxeaylxvd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5aG50cGFkaWlweHhlYXlseHZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NjAwMTIsImV4cCI6MjA5ODAzNjAxMn0.sKPg-VPXX_dvdWvrlKO6uhvPfLvaz1Z00S46omm8hZQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
