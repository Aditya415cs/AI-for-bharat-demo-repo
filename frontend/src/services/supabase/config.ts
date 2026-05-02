import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cymvgsxlpjpobziyraob.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5bXZnc3hscGpwb2J6aXlyYW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzA1NjAsImV4cCI6MjA5MzAwNjU2MH0.UUYYZ7rjUKFE8lyAZ9mq8I35TxI6UCvRnX0qxzS-w1Q';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
