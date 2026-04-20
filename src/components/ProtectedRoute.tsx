import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedUserTypes?: ('user' | 'photographer')[];
    requireAdmin?: boolean;
}

export function ProtectedRoute({ children, allowedUserTypes, requireAdmin }: ProtectedRouteProps) {
    const { user, profile, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Handle unauthenticated users
    if (!user) {
        // Redirect to partner login if trying to access partner routes
        if (location.pathname.startsWith('/partner')) {
            return <Navigate to="/partner/login" state={{ from: location }} replace />;
        }
        // Redirect to signin while saving the attempted location
        return <Navigate to="/signin" state={{ from: location }} replace />;
    }

    // If user is logged in but profile is STILL null after loading finished, it's a database inconsistency
    if (user && !profile) {
        return (
            <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-2xl font-bold text-on-surface mb-2">Profile Not Found</h1>
                <p className="text-on-surface-variant mb-6">We found your account but couldn't load your profile. Please try signing in again.</p>
                <button onClick={() => window.location.href = '/signin'} className="signature-gradient text-white px-8 py-3 rounded-full font-bold shadow-lg">
                    Return to Sign In
                </button>
            </div>
        );
    }

    // Check admin requirement - only redirect non-admins AWAY from admin routes
    if (requireAdmin && !profile?.is_admin) {
        // If trying to access admin route but not an admin, go to home
        return <Navigate to="/" replace />;
    }

    // If allowedUserTypes is specified, check if user has the required type
    if (allowedUserTypes && profile && !allowedUserTypes.includes(profile.user_type)) {
        // Redirect to dashboard if user doesn't have the required type
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
}
