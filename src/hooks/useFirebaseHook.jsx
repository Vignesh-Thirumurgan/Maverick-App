/* global __firebase_config, __app_id, __initial_auth_token */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithCustomToken, signOut } from 'firebase/auth'; // Added signOut import
import { getFirestore, doc, onSnapshot, getDoc } from 'firebase/firestore'; // Added getDoc import

// Create a context for Firebase
const FirebaseContext = createContext(null);

// Custom hook to use Firebase services
export const useFirebase = () => {
    const context = useContext(FirebaseContext);
    if (!context) {
        throw new Error('useFirebase must be used within a FirebaseProvider');
    }
    return context;
};

// Firebase Provider component
export const FirebaseProvider = ({ children }) => {
    const [app, setApp] = useState(null);
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [geminiApiKey, setGeminiApiKey] = useState('');

    const localFirebaseConfig = {
apiKey: "AIzaSyBfv_l0XOFLUd2yaQNoPk3RuVv248aAS8g",
  authDomain: "project-maverick-70ab8.firebaseapp.com",
  projectId: "project-maverick-70ab8",
  storageBucket: "project-maverick-70ab8.firebasestorage.app",
  messagingSenderId: "1011931296883",
  appId: "1:1011931296883:web:d8cc29b6bdf540426de606"
    };

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    useEffect(() => {
        const initializeFirebase = async () => {
            try {
                const firebaseConfig = typeof __firebase_config !== 'undefined' && Object.keys(JSON.parse(__firebase_config)).length > 0
                    ? JSON.parse(__firebase_config)
                    : localFirebaseConfig;

                console.log("Firebase Provider: Using Firebase Config:", firebaseConfig);

                const firebaseApp = initializeApp(firebaseConfig);
                setApp(firebaseApp);

                const authInstance = getAuth(firebaseApp);
                const dbInstance = getFirestore(firebaseApp);
                setAuth(authInstance);
                setDb(dbInstance);

                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(authInstance, __initial_auth_token);
                    console.log("Firebase Provider: Signed in with custom token.");
                }

                setGeminiApiKey('AIzaSyDCK71nmlbEL9-t_vnEEjoV9SHOSTyX0YI');

                // Listener for auth state changes
                const unsubscribeAuth = onAuthStateChanged(authInstance, async (user) => {
                    console.log("Firebase Provider: Auth state changed. User:", user ? user.uid : "null");
                    if (user) {
                        setUserId(user.uid);

                        if (dbInstance) {
                            // Corrected path: Look for profile in the 'data' document within the 'profile' collection
                            const userDocRef = doc(dbInstance, `artifacts/${appId}/users/${user.uid}/profile/data`);

                            // Instead of onSnapshot immediately, we'll first check if the profile exists.
                            // If it doesn't, we might sign out this user.
                            try {
                                const docSnap = await getDoc(userDocRef); // Use getDoc to check existence once

                                if (docSnap.exists()) {
                                    const data = docSnap.data();
                                    setUserRole(data.userType || 'employee');
                                    console.log("Firebase Provider: User profile loaded, role:", data.userType);

                                    // Now, set up real-time listener for ongoing profile changes
                                    const unsubscribeProfile = onSnapshot(userDocRef, (updatedDocSnap) => {
                                        if (updatedDocSnap.exists()) {
                                            const updatedData = updatedDocSnap.data();
                                            setUserRole(updatedData.userType || 'employee');
                                        } else {
                                            // Profile was deleted while user was logged in
                                            setUserRole(null);
                                            console.log("Firebase Provider: User profile deleted.");
                                        }
                                    }, (error) => {
                                        console.error("Firebase Provider: Error updating user profile:", error);
                                    });
                                    setIsAuthReady(true);
                                    return () => unsubscribeProfile(); // Clean up real-time listener
                                } else {
                                    // User exists but no profile document found.
                                    // This means it's likely an unprofiled anonymous user, or
                                    // a user from an incomplete sign-up process.
                                    setUserRole(null);
                                    console.log("Firebase Provider: User profile does not exist for this user. Signing out.");
                                    await signOut(authInstance); // Explicitly sign out unprofiled user
                                    setIsAuthReady(true); // Mark ready after attempting sign out
                                }
                            } catch (error) {
                                console.error("Firebase Provider: Error checking user profile existence:", error);
                                setUserRole(null);
                                setIsAuthReady(true); // Mark ready even on error
                            }

                        } else {
                            console.warn("Firebase Provider: Firestore DB not ready when auth state changed with a user.");
                            setIsAuthReady(true);
                        }
                    } else {
                        setUserId(null);
                        setUserRole(null);
                        setIsAuthReady(true); // Auth check complete, no user logged in
                        console.log("Firebase Provider: No user logged in.");
                    }
                });

                return () => unsubscribeAuth();
            } catch (error) {
                console.error("Firebase initialization error:", error);
                setIsAuthReady(true); // Mark as ready even on error to avoid infinite loading
            }
        };

        initializeFirebase();
    }, [appId, JSON.stringify(localFirebaseConfig)]); // JSON.stringify for object dependency

    const value = {
        app,
        db,
        auth,
        userId,
        userRole,
        isAuthReady,
        geminiApiKey,
        appId
    };

    return (
        <FirebaseContext.Provider value={value}>
            {children}
        </FirebaseContext.Provider>
    );
};
