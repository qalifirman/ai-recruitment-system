// src/utils/supabase/info.tsx

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const serviceRoleKey = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

// Use the function name you deployed (make-server-76bea622)
export const serverFunctionUrl = `${supabaseUrl}/functions/v1/make-server-76bea622`;