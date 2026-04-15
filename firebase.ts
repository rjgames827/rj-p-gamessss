import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, query, where, getDocs, orderBy, limit, getDocFromServer, FirestoreError, serverTimestamp, updateDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  console.log("Starting Google Sign-In...");
  try {
    const result = await signInWithPopup(auth, googleProvider);
    console.log("Google Sign-In successful:", result.user.email);
    // Create user doc if it doesn't exist
    const userDoc = doc(db, 'users', result.user.uid);
    const docSnap = await getDoc(userDoc);
    
    // Check if user is an allowed admin
    let isAllowedAdmin = false;
    if (result.user.email) {
      const allowedAdminDoc = await getDoc(doc(db, 'allowed_admins', result.user.email.toLowerCase()));
      isAllowedAdmin = allowedAdminDoc.exists();
    }

    // Determine role based on email
    const emailLower = result.user.email?.toLowerCase();
    let userRole = 'user';
    if (emailLower === 'lily.smith7406@gmail.com') {
      userRole = 'owner';
    } else if (emailLower === 'pcidiagnosticbus@gmail.com') {
      userRole = 'co-owner';
    } else if (emailLower === 'darkfn1234567890@gmail.com' || emailLower === 'whitecaleb888@gmail.com') {
      userRole = 'admin';
    } else if (isAllowedAdmin) {
      userRole = 'admin';
    }

    if (!docSnap.exists()) {
      console.log("Creating new user document for:", result.user.email);
      
      await setDoc(userDoc, {
        uid: result.user.uid,
        email: result.user.email || null,
        displayName: result.user.displayName || null,
        photoURL: result.user.photoURL || null,
        role: userRole,
        createdAt: serverTimestamp()
      });
    } else {
      // Update role if they are an admin but their role is not set correctly
      const currentRole = docSnap.data().role;
      const shouldBeAdmin = emailLower === 'lily.smith7406@gmail.com' || 
                           emailLower === 'pcidiagnosticbus@gmail.com' ||
                           emailLower === 'darkfn1234567890@gmail.com' || 
                           emailLower === 'whitecaleb888@gmail.com' || 
                           isAllowedAdmin;
      
      if (shouldBeAdmin && (currentRole !== userRole)) {
        await updateDoc(userDoc, { role: userRole });
      }
    }
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export const signUpWithEmail = async (email: string, pass: string, username: string) => {
  console.log("Starting Email Sign-Up for:", email);
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    console.log("Email Sign-Up successful:", result.user.email);
    await updateProfile(result.user, { displayName: username });
    
    // Create user doc
    console.log("Creating user document for:", email);
    
    const emailLower = email.toLowerCase();
    let isAllowedAdmin = false;
    if (emailLower) {
      const allowedAdminDoc = await getDoc(doc(db, 'allowed_admins', emailLower));
      isAllowedAdmin = allowedAdminDoc.exists();
    }

    // Determine role based on email
    let userRole = 'user';
    if (emailLower === 'lily.smith7406@gmail.com') {
      userRole = 'owner';
    } else if (emailLower === 'pcidiagnosticbus@gmail.com') {
      userRole = 'co-owner';
    } else if (emailLower === 'darkfn1234567890@gmail.com' || emailLower === 'whitecaleb888@gmail.com') {
      userRole = 'admin';
    } else if (isAllowedAdmin) {
      userRole = 'admin';
    }

    await setDoc(doc(db, 'users', result.user.uid), {
      uid: result.user.uid,
      email: result.user.email || null,
      displayName: username || null,
      photoURL: result.user.photoURL || null,
      role: userRole,
      createdAt: serverTimestamp()
    });
    
    return result.user;
  } catch (error) {
    console.error("Error signing up with email:", error);
    throw error;
  }
};

export const loginWithEmail = async (email: string, pass: string) => {
  console.log("Starting Email Login for:", email);
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    console.log("Email Login successful:", result.user.email);

    const userDocRef = doc(db, 'users', result.user.uid);
    const docSnap = await getDoc(userDocRef);
    
    if (docSnap.exists()) {
      let isAllowedAdmin = false;
      const userEmailLower = result.user.email?.toLowerCase();
      if (userEmailLower) {
        const allowedAdminDoc = await getDoc(doc(db, 'allowed_admins', userEmailLower));
        isAllowedAdmin = allowedAdminDoc.exists();
      }
      
      // Determine correct role based on email
      let correctRole = 'user';
      if (userEmailLower === 'lily.smith7406@gmail.com') {
        correctRole = 'owner';
      } else if (userEmailLower === 'pcidiagnosticbus@gmail.com') {
        correctRole = 'co-owner';
      } else if (userEmailLower === 'darkfn1234567890@gmail.com' || userEmailLower === 'whitecaleb888@gmail.com') {
        correctRole = 'admin';
      } else if (isAllowedAdmin) {
        correctRole = 'admin';
      }
      
      const currentRole = docSnap.data().role;
      const shouldBeAdmin = userEmailLower === 'lily.smith7406@gmail.com' || 
                           userEmailLower === 'pcidiagnosticbus@gmail.com' ||
                           userEmailLower === 'darkfn1234567890@gmail.com' || 
                           userEmailLower === 'whitecaleb888@gmail.com' || 
                           isAllowedAdmin;
      
      if (shouldBeAdmin && currentRole !== correctRole) {
        await updateDoc(userDocRef, { role: correctRole });
      }
    }

    return result.user;
  } catch (error) {
    console.error("Error logging in with email:", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  const errorString = JSON.stringify(errInfo);
  console.error('Firestore Error: ', errorString);
  
  throw new Error(errorString);
}

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
