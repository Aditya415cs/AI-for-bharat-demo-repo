import { supabase } from './config';

export const loginUser = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.user;
};

export const registerUser = async (name: string, email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  });
  
  if (error) throw error;

  // Store user details in the profiles table
  if (data.user) {
    // Fix 1.8: Include role: 'candidate' so new users are not rejected by the admin dashboard
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: data.user.id,
        full_name: name,
        email: email,
        role: 'candidate',
        updated_at: new Date(),
      });
    
    if (profileError) {
      console.error('Error creating profile:', profileError);
    }
  }

  return data.user;
};

export const updateUserProfile = async (updates: { 
  full_name?: string; 
  trade?: string; 
  experience?: string;
  phone?: string;
  age?: string;
  gender?: string;
  district?: string;
  experience_level?: string;
  skills?: string[];
  education?: string;
  work_preference?: string;
}) => {
  // 1. Update Auth User Metadata
  const { data: authData, error: authError } = await supabase.auth.updateUser({
    data: { 
      full_name: updates.full_name,
      trade: updates.trade,
    }
  });

  if (authError) throw authError;

  // 2. Update profiles Table with ALL fields
  if (authData.user) {
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email: authData.user.email,
        ...updates,
        updated_at: new Date(),
      });

    if (profileError) {
      console.error('Error updating profiles table:', profileError);
    }
  }

  return authData.user;
};

export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
};
