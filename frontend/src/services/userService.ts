const USER_ID_KEY = 'jalwatch_citizen_uid';
const USER_NAME_KEY = 'jalwatch_citizen_name';

export interface UserProfile {
  id: string;
  name: string;
  locality: string;
  description: string;
}

export const PRESET_USERS: UserProfile[] = [
  { id: 'usr_rohan_rohini', name: 'Rohan Sharma', locality: 'Rohini Sector 7', description: 'Resident near Sector 7 market' },
  { id: 'usr_priya_okhla', name: 'Priya Verma', locality: 'Okhla Phase III', description: 'Industrial area employee' },
  { id: 'usr_amit_mayurvihar', name: 'Amit Kumar', locality: 'Mayur Vihar Pocket 1', description: 'Resident near East Delhi drain' },
  { id: 'usr_neha_karolbagh', name: 'Neha Gupta', locality: 'Karol Bagh Block 4', description: 'Commercial & residential area' },
];

/**
 * Retrieves the persistent anonymous user ID from localStorage or creates a default one.
 */
export function getOrCreateUserId(): string {
  try {
    let uid = localStorage.getItem(USER_ID_KEY);
    if (!uid) {
      uid = PRESET_USERS[0].id;
      localStorage.setItem(USER_ID_KEY, uid);
      localStorage.setItem(USER_NAME_KEY, PRESET_USERS[0].name);
    }
    return uid;
  } catch {
    return PRESET_USERS[0].id;
  }
}

/**
 * Retrieves cached citizen display name.
 */
export function getSavedUserName(): string {
  try {
    return localStorage.getItem(USER_NAME_KEY) || PRESET_USERS[0].name;
  } catch {
    return PRESET_USERS[0].name;
  }
}

/**
 * Persists citizen display name to localStorage.
 */
export function saveUserName(name: string): void {
  try {
    localStorage.setItem(USER_NAME_KEY, name.trim());
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

/**
 * Switches the active user identity (useful for testing multiple citizen accounts).
 */
export function switchActiveUser(id: string, name: string): void {
  try {
    localStorage.setItem(USER_ID_KEY, id);
    localStorage.setItem(USER_NAME_KEY, name);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Generates and switches to a brand new anonymous citizen ID.
 */
export function createNewRandomUser(): UserProfile {
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const newProfile: UserProfile = {
    id: `usr_citizen_${randomSuffix}`,
    name: `Citizen ${randomSuffix.toUpperCase()}`,
    locality: 'Delhi',
    description: 'New guest citizen',
  };
  switchActiveUser(newProfile.id, newProfile.name);
  return newProfile;
}
