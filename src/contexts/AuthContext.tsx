import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UserProfile {
    id: string;
    email: string;
    full_name: string;
    user_type: 'user' | 'individual' | 'photographer';
    is_admin: boolean;
    avatar_url?: string;
    selfie_descriptor?: string;
    created_at: string;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    loading: boolean;
    signUp: (email: string, password: string, fullName: string, userType: 'user' | 'individual' | 'photographer') => Promise<{ error: Error | null }>;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    updateProfile: (updates: Partial<UserProfile>) => Promise<{ error: Error | null }>;
    refreshProfile: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: Error | null }>;
    updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const isSigningOutRef = useRef(false);
    const mountedRef = useRef(true);
    const profileFetchIdRef = useRef<string | null>(null);
    const initializingRef = useRef(false);
    const initializationPromiseRef = useRef<Promise<void> | null>(null);

    const fetchProfile = useCallback(async (userId: string) => {
        // Deduplicate concurrent fetches for the same user
        if (profileFetchIdRef.current === userId) {
            return;
        }
        profileFetchIdRef.current = userId;

        try {
            console.log('[Auth] Fetching profile for user:', userId);
            
            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Profile fetch timed out')), 8000)
            );

            // Race the profile fetch against the timeout
            const profileQuery = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            const { data, error } = await Promise.race([
                profileQuery,
                timeoutPromise.then(() => ({ data: null, error: { message: 'Timeout' } }))
            ]) as any;

            if (!mountedRef.current) return;

            if (error) {
                console.error('[Auth] Error fetching profile:', error.message);
                setProfile(null);
                return;
            }

            if (data) {
              console.log('[Auth] Profile fetched for:', userId, '| is_admin:', !!data.is_admin, '| user_type:', data.user_type);
            } else {
              console.warn('[Auth] No profile found in DB for user:', userId);
            }
            // Ensure is_admin is explicitly boolean
            setProfile(data ? { ...data, is_admin: !!data.is_admin } : null);
        } catch (error) {
            console.error('[Auth] Unexpected error fetching profile:', error);
            if (mountedRef.current) {
                setProfile(null);
            }
        } finally {
            profileFetchIdRef.current = null;
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        // Ensure initialization happens only once, even with concurrent mounts
        if (initializingRef.current || initializationPromiseRef.current) {
            // Already initializing or initialized, wait for it
            if (initializationPromiseRef.current) {
                initializationPromiseRef.current.finally(() => {
                    if (mountedRef.current) {
                        setLoading(false);
                    }
                });
            }
            return;
        }

        const initializeAuth = async () => {
            if (!mountedRef.current) return;
            
            initializingRef.current = true;
            
            try {
                console.log('[Auth] Initializing auth session...');
                
                // Retry logic for lock acquisition errors
                let retries = 0;
                const MAX_RETRIES = 3;
                const RETRY_DELAY = 300; // ms
                
                const getSessionWithRetry = async (): Promise<Session | null> => {
                    while (retries < MAX_RETRIES) {
                        try {
                            const { data: { session }, error } = await supabase.auth.getSession();
                            if (error) throw error;
                            return session;
                        } catch (err: any) {
                            const errMsg = err?.message || '';
                            // Check if it's a lock timeout error
                            if (errMsg.includes('Lock') || errMsg.includes('was released')) {
                                retries++;
                                if (retries < MAX_RETRIES) {
                                    console.log(`[Auth] Lock contention detected, retrying (${retries}/${MAX_RETRIES})...`);
                                    // Exponential backoff: 300ms, 600ms, 900ms
                                    await new Promise(r => setTimeout(r, RETRY_DELAY * retries));
                                    continue;
                                }
                            }
                            throw err;
                        }
                    }
                    return null;
                };
                
                const session = await getSessionWithRetry();
                
                if (!mountedRef.current) return;

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user) {
                    await fetchProfile(session.user.id);
                }
            } catch (error) {
                console.error('[Auth] Error initializing auth:', error);
                if (mountedRef.current) {
                    setLoading(false);
                }
            } finally {
                initializingRef.current = false;
                if (mountedRef.current) {
                    setLoading(false);
                }
            }
        };

        const initPromise = initializeAuth().catch(err => {
            console.error('[Auth] Initialization promise rejected:', err);
        });
        
        initializationPromiseRef.current = initPromise;

        // Set up listener with proper cleanup
        let subscription: any = null;
        
        const setupListener = async () => {
            // Wait for initialization to complete first
            await initPromise;
            
            if (!mountedRef.current) return;
            
            console.log('[Auth] Setting up auth state listener...');
            
            // Listen for auth changes
            const { data } = supabase.auth.onAuthStateChange(
                async (event, newSession) => {
                    if (!mountedRef.current) return;

                    // Skip INITIAL_SESSION — handled by initializeAuth above
                    if (event === 'INITIAL_SESSION') {
                        console.log('[Auth] Skipping INITIAL_SESSION event');
                        return;
                    }

                    console.log('[Auth] Auth state changed:', event, 'User:', newSession?.user?.id);

                    try {
                        setSession(newSession);
                        setUser(newSession?.user ?? null);

                        if (event === 'SIGNED_OUT') {
                            console.log('[Auth] User signed out');
                            // If we're offline, this might be a spurious sign-out due to a failed token refresh.
                            // We should only truly clear everything if we are online or if it's an explicit action.
                            if (navigator.onLine) {
                                setProfile(null);
                                setLoading(false);
                            } else {
                                console.log('[Auth] Browser is offline. Ignoring SIGNED_OUT event to preserve session.');
                            }
                            return;
                        }

                        if (newSession?.user) {
                            console.log('[Auth] User session available, fetching profile...');
                            await fetchProfile(newSession.user.id);
                        } else {
                            console.log('[Auth] No user in session');
                            setProfile(null);
                        }
                    } catch (err) {
                        console.error('[Auth] Error during auth state change handling:', err);
                        setLoading(false);
                    } finally {
                        if (mountedRef.current) {
                            console.log('[Auth] Setting loading to false (from listener)');
                            setLoading(false);
                        }
                    }
                }
            );
            
            subscription = data.subscription;
        };

        // Start listener setup immediately
        setupListener().catch(err => {
            console.error('[Auth] Failed to set up listener:', err);
        });

        return () => {
            mountedRef.current = false;
            if (subscription) {
                console.log('[Auth] Unsubscribing from auth state changes');
                subscription.unsubscribe();
            }
        };
    }, [fetchProfile]);

    async function signUp(email: string, password: string, fullName: string, userType: 'user' | 'photographer') {
        try {
            console.log('[Auth] Attempting sign up for:', email);

            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        user_type: userType,
                    },
                },
            });

            if (error) {
                console.error('[Auth] Sign up error:', error.message);
                return { error };
            }

            console.log('[Auth] Sign up successful for:', data.user?.id);
            return { error: null };
        } catch (error) {
            console.error('[Auth] Unexpected error during sign up:', error);
            const err = error as Error;
            if (err.message.includes('Failed to fetch')) {
                return {
                    error: new Error('Connection timed out. Please check your internet connection and try again.')
                };
            }
            return { error: error as Error };
        }
        // NOTE: No setLoading(false) here. On success, onAuthStateChange fires,
        // fetchProfile runs, and THEN setLoading(false) is called — keeping state in sync.
        // On error, we return early above and the caller is responsible for UI state.
    }

    async function signIn(email: string, password: string) {
        try {
            console.log('[Auth] Attempting sign in for:', email);

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                console.error('[Auth] Sign in error:', error.message);
                if (mountedRef.current) setLoading(false);
                return { error };
            }

            console.log('[Auth] Sign in successful. Session user:', data.user?.id);
            console.log('[Auth] Waiting for onAuthStateChange to handle profile fetch...');
            
            // IMPORTANT: Do NOT set loading=false here. Let the auth state change listener handle it
            // after fetchProfile completes. This prevents redirecting before profile is ready.
            return { error: null };
        } catch (error) {
            console.error('[Auth] Unexpected error during sign in:', error);
            if (mountedRef.current) setLoading(false);
            const err = error as Error;
            if (err.message.includes('Failed to fetch')) {
                return {
                    error: new Error('Connection timed out. Please check your internet connection and try again.')
                };
            }
            return { error: error as Error };
        }
    }

    async function signOut(): Promise<void> {
        // Prevent multiple simultaneous sign-out attempts
        if (isSigningOutRef.current) return;
        isSigningOutRef.current = true;

        try {
            console.log('[Auth] Signing out...');

            // Clear local state first for instant UI feedback
            setUser(null);
            setSession(null);
            setProfile(null);

            // Then tell Supabase to invalidate the session
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('[Auth] Sign out API error:', error.message);
            } else {
                console.log('[Auth] Sign out successful');
            }
        } catch (error) {
            console.error('[Auth] Error during sign out:', error);
        } finally {
            isSigningOutRef.current = false;
        }
    }

    async function updateProfile(updates: Partial<UserProfile>) {
        try {
            if (!user) {
                return { error: new Error('No user logged in') };
            }

            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', user.id);

            if (error) {
                return { error };
            }

            // Refresh profile
            await fetchProfile(user.id);
            return { error: null };
        } catch (error) {
            return { error: error as Error };
        }
    }

    async function refreshProfile() {
        if (user) {
            profileFetchIdRef.current = null; // Reset dedup guard
            await fetchProfile(user.id);
        }
    }

    async function resetPassword(email: string) {
        try {
            console.log('[Auth] Requesting password reset for:', email);

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/password-reset`,
            });

            if (error) {
                console.error('[Auth] Password reset request error:', error.message);
                return { error };
            }

            console.log('[Auth] Password reset email sent successfully');
            return { error: null };
        } catch (error) {
            console.error('[Auth] Unexpected error during password reset request:', error);
            const err = error as Error;
            if (err.message.includes('Failed to fetch')) {
                return {
                    error: new Error('Connection timed out. Please check your internet connection and try again.')
                };
            }
            return { error: error as Error };
        }
    }

    async function updatePassword(password: string) {
        try {
            console.log('[Auth] Updating password...');

            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                console.error('[Auth] Password update error:', error.message);
                return { error };
            }

            console.log('[Auth] Password updated successfully');
            return { error: null };
        } catch (error) {
            console.error('[Auth] Unexpected error updating password:', error);
            const err = error as Error;
            if (err.message.includes('Failed to fetch')) {
                return {
                    error: new Error('Connection timed out. Please check your internet connection and try again.')
                };
            }
            return { error: error as Error };
        }
    }

    const value = {
        user,
        session,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile,
        refreshProfile,
        resetPassword,
        updatePassword,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

