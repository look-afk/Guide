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
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  writeBatch
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

export const connectGmail = async (): Promise<string> => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
  provider.addScope('https://www.googleapis.com/auth/calendar.events');
  provider.setCustomParameters({ prompt: 'consent select_account' });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken;

  if (!token) {
    throw new Error('Google did not return Gmail access. Please try again and approve the requested permissions.');
  }

  cachedAccessToken = token;
  await ensureGuideProfile(result.user);
  return token;
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

export function isValidIsoDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const saveGuideTour = async (guideId: string, tour: Tour, previousDate?: string) => {
  if (!isValidIsoDate(tour.date)) throw new Error('Tour date must be a real calendar date in YYYY-MM-DD format.');
  if (previousDate && !isValidIsoDate(previousDate)) throw new Error('Previous tour date is invalid.');
  const tourRef = doc(db, 'guides', guideId, 'tours', tour.id);
  const newDateRef = doc(db, 'guides', guideId, 'busyDates', tour.date);

  try {
    // 1. If date changed during edit, clean up old date if no other tours exist AND no manual block exists
    if (previousDate && previousDate !== tour.date) {
      const otherToursQuery = query(
        collection(db, 'guides', guideId, 'tours'),
        where('date', '==', previousDate)
      );
      const otherToursSnap = await getDocs(otherToursQuery);
      const remainingTours = otherToursSnap.docs.filter(d => d.id !== tour.id);

      if (remainingTours.length === 0) {
        // Check if there was a manual block on previousDate
        const oldDateDoc = await getDoc(doc(db, 'guides', guideId, 'busyDates', previousDate));
        const oldDateData = oldDateDoc.data() as BusyDateRecord | undefined;
        if (!oldDateData?.isManualBlock) {
          await deleteDoc(doc(db, 'guides', guideId, 'busyDates', previousDate));
        }
      }
    }

    // 2. Save Tour document
    await setDoc(tourRef, tour);

    // 3. Mark the tour date as busy in busyDates
    const existingDateDoc = await getDoc(newDateRef);
    const existingDateData = existingDateDoc.data() as BusyDateRecord | undefined;

    const busyRecord: BusyDateRecord = {
      id: tour.date,
      guideId,
      date: tour.date,
      isBusy: true,
      isManualBlock: Boolean(existingDateData?.isManualBlock), // Preserve manual block flag if it was also manually blocked
      manualBlockReason: existingDateData?.manualBlockReason,
      reason: `${tour.destination} (${tour.clientName})`,
      tourId: tour.id,
      updatedAt: new Date().toISOString()
    };
    await setDoc(newDateRef, busyRecord, { merge: true });
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

    // Check if the date had a manual block
    const dateDocSnap = await getDoc(dateRef);
    const dateData = dateDocSnap.data() as BusyDateRecord | undefined;

    if (remaining.length > 0) {
      // Still has other tours on this day: update busy record with first remaining tour
      const nextTour = remaining[0].data() as Tour;
      await setDoc(dateRef, {
        id: tour.date,
        guideId,
        date: tour.date,
        isBusy: true,
        reason: `${nextTour.destination} (${nextTour.clientName})`,
        tourId: nextTour.id,
        isManualBlock: Boolean(dateData?.isManualBlock),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } else if (dateData?.isManualBlock) {
      // No remaining tours, BUT date was manually blocked by the guide:
      // PRESERVE the manual block! Do not delete the busy date record!
      await setDoc(dateRef, {
        id: tour.date,
        guideId,
        date: tour.date,
        isBusy: true,
        isManualBlock: true,
        reason: dateData.reason || 'Manually Blocked Date',
        tourId: null,
        updatedAt: new Date().toISOString()
      });
    } else {
      // No other tours and no manual block: make the date available
      await deleteDoc(dateRef);
    }

    // Removing a local calendar entry is not proof that the external platform accepted or cancelled anything.
    // Keep the inquiry status unchanged and only detach the local calendar link.
    if (tour.orderId) {
      const orderRef = doc(db, 'guides', guideId, 'orders', tour.orderId);
      await updateDoc(orderRef, {
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
    await setDoc(orderRef, order, { merge: true });
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
    if (calendarTourId !== undefined) {
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

// ----------------- BUSY & BLOCKED DATES -----------------

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

// Block a single date manually
export const blockGuideDate = async (guideId: string, dateStr: string, reason?: string) => {
  if (!isValidIsoDate(dateStr)) throw new Error('Date must be a real calendar date in YYYY-MM-DD format.');
  const dateRef = doc(db, 'guides', guideId, 'busyDates', dateStr);
  try {
    const existingSnap = await getDoc(dateRef);
    const existing = existingSnap.data() as BusyDateRecord | undefined;
    const manualReason = (reason || 'Manually Blocked Date').trim().slice(0, 500);
    const newRecord: BusyDateRecord = {
      id: dateStr, guideId, date: dateStr, isBusy: true, isManualBlock: true,
      manualBlockReason: manualReason,
      reason: existing?.tourId ? existing.reason : manualReason,
      tourId: existing?.tourId || undefined,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(dateRef, newRecord, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `guides/${guideId}/busyDates/${dateStr}`);
  }
};

// Unblock a manually blocked date
export const unblockGuideDate = async (guideId: string, dateStr: string) => {
  if (!isValidIsoDate(dateStr)) throw new Error('Date must be a real calendar date in YYYY-MM-DD format.');
  // Guard: if there are confirmed tours, never remove the busy state!
  const toursQuery = query(
    collection(db, 'guides', guideId, 'tours'),
    where('date', '==', dateStr)
  );
  const toursSnap = await getDocs(toursQuery);
  if (!toursSnap.empty) {
    throw new Error('This date has confirmed tours scheduled. To free this date, please edit or cancel the scheduled tour first.');
  }

  const dateRef = doc(db, 'guides', guideId, 'busyDates', dateStr);
  try {
    await deleteDoc(dateRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `guides/${guideId}/busyDates/${dateStr}`);
  }
};

// Helper to generate array of ISO dates between start and end (inclusive)
export function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  if (!isValidIsoDate(startDateStr) || !isValidIsoDate(endDateStr) || startDateStr > endDateStr) return [];
  const dates: string[] = [];
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);
  const current = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  while (current <= end) {
    dates.push(current.getUTCFullYear() + '-' + String(current.getUTCMonth() + 1).padStart(2, '0') + '-' + String(current.getUTCDate()).padStart(2, '0'));
    if (dates.length > 366) return [];
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

// Block a date range in batch
export const blockGuideDateRange = async (
  guideId: string,
  startDate: string,
  endDate: string,
  reason: string
): Promise<number> => {
  const dates = getDatesInRange(startDate, endDate);
  if (dates.length === 0) throw new Error('Enter a valid date range using real YYYY-MM-DD dates.');
  if (dates.length > 366) throw new Error('A date range cannot exceed 366 days.');

  try {
    const batch = writeBatch(db);
    const reasonText = (reason || 'Manually Blocked Period').trim().slice(0, 500);
    const existingRecords = await Promise.all(dates.map(async (d) => {
      const snap = await getDoc(doc(db, 'guides', guideId, 'busyDates', d));
      return [d, snap.data() as BusyDateRecord | undefined] as const;
    }));
    const existingByDate = new Map(existingRecords);
    for (const d of dates) {
      const dateRef = doc(db, 'guides', guideId, 'busyDates', d);
      const existing = existingByDate.get(d);
      const record: BusyDateRecord = {
        id: d, guideId, date: d, isBusy: true, isManualBlock: true,
        manualBlockReason: reasonText,
        reason: existing?.tourId ? existing.reason : reasonText,
        tourId: existing?.tourId || undefined,
        updatedAt: new Date().toISOString()
      };
      batch.set(dateRef, record, { merge: true });
    }
    await batch.commit();
    return dates.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `guides/${guideId}/busyDates/batch`);
    return 0;
  }
};

// Unblock a date range in batch (skips any dates that have confirmed tours)
export const unblockGuideDateRange = async (
  guideId: string,
  startDate: string,
  endDate: string
): Promise<{ unblockedCount: number; protectedTourDates: string[] }> => {
  const dates = getDatesInRange(startDate, endDate);
  if (dates.length === 0) throw new Error('Enter a valid date range using real YYYY-MM-DD dates.');
  if (dates.length > 366) throw new Error('A date range cannot exceed 366 days.');

  try {
    // Find all tours in the user's collection to check protected dates
    const toursQuery = query(collection(db, 'guides', guideId, 'tours'));
    const toursSnap = await getDocs(toursQuery);
    const tourDatesSet = new Set<string>();
    toursSnap.docs.forEach(docSnap => {
      const t = docSnap.data() as Tour;
      if (t.date) tourDatesSet.add(t.date);
    });

    const batch = writeBatch(db);
    let unblockedCount = 0;
    const protectedTourDates: string[] = [];

    for (const d of dates) {
      if (tourDatesSet.has(d)) {
        protectedTourDates.push(d);
      } else {
        const dateRef = doc(db, 'guides', guideId, 'busyDates', d);
        batch.delete(dateRef);
        unblockedCount++;
      }
    }

    if (unblockedCount > 0) {
      await batch.commit();
    }

    return { unblockedCount, protectedTourDates };
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `guides/${guideId}/busyDates/batch`);
    return { unblockedCount: 0, protectedTourDates: [] };
  }
};
