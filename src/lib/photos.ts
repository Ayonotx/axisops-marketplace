import type { Listing } from "./db";

export function photoUrl(filename: string): string {
  return `/api/photos/${filename}`;
}

/** Build a full photo URL list for a listing (empty array = no photos). */
export function listingPhotoUrls(listingId: number, filenames: string[]): string[] {
  void listingId;
  return filenames.map(photoUrl);
}

export function tilePhoto(listing: Listing, primary?: string) {
  return primary ? photoUrl(primary) : null;
}
