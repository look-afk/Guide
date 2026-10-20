import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  collection, 
  setDoc, 
  updateDoc,
  deleteDoc, 
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Tour, Order, BusyDateRecord, BusyDateMap, GuideProfile, OrderStatus } from '../types';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific databaseId
const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-9fbbd071-edf5-4f50-a0e3-73d8813d5494';
export const db = getFirestore(app, firestoreDbId);

// Initialize Auth
export const auth = getAuth(app);

// Google Auth Provider with Calendar and Gmail Readonly scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');

// In-memory token cache for Google Workspace APIs
let cachedAccessToken: string | null = null;
let isSigningIn = false;

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    }
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is connecting...');
    }
  }
}
testConnection();

// Auth Listeners & Actions
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInGuide = async (): Promise<{ user: User; accessToken: string | null } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || null;

    if (result.user) {
      await ensureGuideProfile(result.user);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const signOutGuide = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Guide Profile
export const ensureGuideProfile = async (user: User): Promise<GuideProfile> => {
  const guideRef = doc(db, 'guides', user.uid);
  const profile: GuideProfile = {
    id: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'Tour Guide',
    photoURL: user.photoURL || undefined,
    role: 'guide',
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(guideRef, profile, { merge: true });
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `guides/${user.uid}`);
    return profile;
  }
};

// ----------------- TOURS -----------------

export const subscribeToGuideTours = (
  guideId: string,
  onUpdate: (tours: Tour[]) => void,
  onError?: (err: Error) => void
) => {
  const toursRef = collection(db, 'guides', guideId, 'tours');
  return onSnapshot(
    toursRef,
    (snapshot) => {
      const tours = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tour));
      onUpdate(tours);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `guides/${guideId}/tours`);
      if (onError) onError(error);
    }
  );
};

export const saveGuideTour = async (guideId: string, tour: Tour) => {
  const tourRef = doc(db, 'guides', guideId, 'tours', tour.id);
  const dateRef = doc(db, 'guides', guideId, 'busyDates', tour.date);

  try {
    // 1. Save Tour
    await setDoc(tourRef, tour);

    // 2. Automatically mark date as busy on the calendar
    const busyRecord: BusyDateRecord = {
      id: tour.date,
      guideId,
      date: tour.date,
      isBusy: true,
      reason: `${tour.destination} (${tour.clientName})`,
      tourId: tour.id,
      updatedAt: new Date().toISOString()
    };
    await setDoc(dateRef, busyRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `guides/${guideId}/tours/${tour.id}`);
  }
};

export const deleteGuideTour = async (guideId: string, tour: Tour) => {
  const tourRef = doc(db, 'guides', guideId, 'tours', tour.id);
  const dateRef = doc(db, 'guides', guideId, 'busyDates', tour.date);

  try {
    await deleteDoc(tourRef);
    // Remove busy mark if linked to this tour
    await deleteDoc(dateRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `guides/${guideId}/tours/${tour.id}`);
  }
};

// ----------------- ORDERS -----------------

export const subscribeToGuideOrders = (
  guideId: string,
  onUpdate: (orders: Order[]) => void,
  onError?: (err: Error) => void
) => {
  const ordersRef = collection(db, 'guides', guideId, 'orders');
  return onSnapshot(
    ordersRef,
    (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      // Sort newest first
      orders.sort((a, b) => new Date(b.receivedAt || b.createdAt).getTime() - new Date(a.receivedAt || a.createdAt).getTime());
      onUpdate(orders);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `guides/${guideId}/orders`);
      if (onError) onError(error);
    }
  );
};

export const saveGuideOrder = async (guideId: string, order: Order) => {
  const orderRef = doc(db, 'guides', guideId, 'orders', order.id);
  try {
    await setDoc(orderRef, order);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `guides/${guideId}/orders/${order.id}`);
  }
};

export const updateOrderStatus = async (
  guideId: string, 
  orderId: string, 
  status: OrderStatus, 
  calendarTourId?: string
) => {
  const orderRef = doc(db, 'guides', guideId, 'orders', orderId);
  try {
    const updateData: Partial<Order> = {
      status,
      updatedAt: new Date().toISOString()
    };
    if (calendarTourId) {
      updateData.calendarTourId = calendarTourId;
    }
    await updateDoc(orderRef, updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `guides/${guideId}/orders/${orderId}`);
  }
};

// ----------------- BUSY DATES -----------------

export const subscribeToGuideBusyDates = (
  guideId: string,
  onUpdate: (dates: BusyDateMap) => void,
  onError?: (err: Error) => void
) => {
  const busyDatesRef = collection(db, 'guides', guideId, 'busyDates');
  return onSnapshot(
    busyDatesRef,
    (snapshot) => {
      const dateMap: BusyDateMap = {};
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as BusyDateRecord;
        if (data && data.isBusy) {
          dateMap[docSnap.id] = data;
        }
      });
      onUpdate(dateMap);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `guides/${guideId}/busyDates`);
      if (onError) onError(error);
    }
  );
};

export const toggleGuideDate = async (
  guideId: string,
  dateStr: string,
  currentStatus?: BusyDateRecord,
  reason?: string
) => {
  const dateRef = doc(db, 'guides', guideId, 'busyDates', dateStr);
  const isCurrentlyBusy = Boolean(currentStatus?.isBusy);

  try {
    if (isCurrentlyBusy) {
      await deleteDoc(dateRef);
    } else {
      const newRecord: BusyDateRecord = {
        id: dateStr,
        guideId,
        date: dateStr,
        isBusy: true,
        reason: reason || 'Busy (No Tours Available)',
        updatedAt: new Date().toISOString(),
      };
      await setDoc(dateRef, newRecord);
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isCurrentlyBusy ? OperationType.DELETE : OperationType.WRITE,
      `guides/${guideId}/busyDates/${dateStr}`
    );
  }
};
