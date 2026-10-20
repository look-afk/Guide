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
  getDocs,
  query,
  where,
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
      const tours = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Tour));
      // Sort chronologically
      tours.sort((a, b) => a.date.localeCompare(b.date));
      onUpdate(tours);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `guides/${guideId}/tours`);
      if (onError) onError(error);
    }
  );
};

export const saveGuideTour = async (guideId: string, tour: Tour, previousDate?: string) => {
  const tourRef = doc(db, 'guides', guideId, 'tours', tour.id);
  const newDateRef = doc(db, 'guides', guideId, 'busyDates', tour.date);

  try {
    // 1. If date changed during edit, clean up old date if no other tours exist
    if (previousDate && previousDate !== tour.date) {
      const otherToursQuery = query(
        collection(db, 'guides', guideId, 'tours'),
        where('date', '==', previousDate)
      );
      const otherToursSnap = await getDocs(otherToursQuery);
      const remainingTours = otherToursSnap.docs.filter(d => d.id !== tour.id);
      if (remainingTours.length === 0) {
        await deleteDoc(doc(db, 'guides', guideId, 'busyDates', previousDate));
      }
    }

    // 2. Save Tour document
    await setDoc(tourRef, tour);

    // 3. Mark the tour date as busy
    const busyRecord: BusyDateRecord = {
      id: tour.date,
      guideId,
      date: tour.date,
      isBusy: true,
      reason: `${tour.destination} (${tour.clientName})`,
      tourId: tour.id,
      updatedAt: new Date().toISOString()
    };
    await setDoc(newDateRef, busyRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `guides/${guideId}/tours/${tour.id}`);
  }
};

export const deleteGuideTour = async (guideId: string, tour: Tour) => {
  const tourRef = doc(db, 'guides', guideId, 'tours', tour.id);
  const dateRef = doc(db, 'guides', guideId, 'busyDates', tour.date);

  try {
    // 1. Delete tour document
    await deleteDoc(tourRef);

    // 2. Check if there are other confirmed tours on this same date
    const sameDateToursQuery = query(
      collection(db, 'guides', guideId, 'tours'),
      where('date', '==', tour.date)
    );
    const sameDateSnap = await getDocs(sameDateToursQuery);
    const remaining = sameDateSnap.docs.filter(d => d.id !== tour.id);

    // Only make the date available if no other tours remain on this day
    if (remaining.length === 0) {
      await deleteDoc(dateRef);
    } else {
      // Update busy record with first remaining tour
      const nextTour = remaining[0].data() as Tour;
      await setDoc(dateRef, {
        id: tour.date,
        guideId,
        date: tour.date,
        isBusy: true,
        reason: `${nextTour.destination} (${nextTour.clientName})`,
        tourId: nextTour.id,
        updatedAt: new Date().toISOString()
      });
    }

    // 3. If tour was linked to an order, revert order status to accepted
    if (tour.orderId) {
      const orderRef = doc(db, 'guides', guideId, 'orders', tour.orderId);
      await updateDoc(orderRef, {
        status: 'accepted',
        calendarTourId: null,
        updatedAt: new Date().toISOString()
      }).catch(() => {});
    }
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
      const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      // Sort newest received first
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

export const deleteGuideOrder = async (guideId: string, orderId: string) => {
  const orderRef = doc(db, 'guides', guideId, 'orders', orderId);
  try {
    await deleteDoc(orderRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `guides/${guideId}/orders/${orderId}`);
  }
};

// Check if an emailMessageId already exists in Firestore
export const checkOrderExistsByMessageId = async (guideId: string, messageId: string): Promise<boolean> => {
  try {
    const q = query(
      collection(db, 'guides', guideId, 'orders'),
      where('emailMessageId', '==', messageId)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (error) {
    console.warn('Error checking existing message ID:', error);
    return false;
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
  hasConfirmedTours: boolean = false,
  reason?: string
) => {
  // CRITICAL REQUIREMENT 1: Clicking a busy date must NOT accidentally remove a confirmed tour!
  if (hasConfirmedTours) {
    throw new Error('This date has confirmed tours scheduled. To free this date, please edit or cancel the scheduled tour.');
  }

  // Also query Firestore to guarantee we don't accidentally remove a tour
  const toursQuery = query(
    collection(db, 'guides', guideId, 'tours'),
    where('date', '==', dateStr)
  );
  const toursSnap = await getDocs(toursQuery);
  if (!toursSnap.empty) {
    throw new Error('This date has confirmed tours scheduled. To free this date, please edit or cancel the scheduled tour.');
  }

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
        reason: reason || 'Manually Blocked Date',
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
