/**
 * shopProfile.js — the shop owner's own profile, read by the header/rail
 * avatar and by /shop-home/account/settings' Personal Information tab.
 *
 * Backed by auth-service's existing "me" self-service routes:
 *   GET   {AUTH_BASE}/auth/me                        -> ShopOwnerView (live profile)
 *   POST  {AUTH_BASE}/auth/me/kyc-documents/upload    -> { url }  (type=avatar)
 *   PUT   {AUTH_BASE}/auth/me/avatar                  -> ShopOwnerView (persists it)
 *   PATCH {AUTH_BASE}/auth/me                         { name?, personalAddress?, addrState?, addrDistrict?,
 *                                                        addrTaluk?, addrArea?, addrStreet?, addrPincode? }
 *                                                      -> ShopOwnerView (partial — only sent fields are applied)
 *   POST  {AUTH_BASE}/auth/me/email/otp/send          { email } -> { sent, devOtp }
 *   POST  {AUTH_BASE}/auth/me/email/otp/verify        { email, otp } -> ShopOwnerView
 *   POST  {AUTH_BASE}/auth/me/mobile/otp/send         { mobile } -> { sent, defaultOtp }
 *   POST  {AUTH_BASE}/auth/me/mobile/otp/verify       { mobile, otp } -> ShopOwnerView
 *
 * Email and mobile are NOT a plain PATCH like name — they're also the login
 * identifiers, so each goes through a send-OTP-to-the-NEW-value step before
 * the backend will persist it. Mobile OTP is always "123456": no SMS gateway
 * exists anywhere in this codebase, same limitation every other mobile-OTP
 * flow here already has.
 *
 * AUTH_BASE() already ends in "/auth" (see src/lib/api.js) — nginx strips that
 * prefix before proxying, and the Spring controller is @RequestMapping("/auth"),
 * so every path below repeats "/auth/..." same as shopAuth.js's login() does.
 *
 * Upload and save are two separate calls (mirrors the existing KYC document
 * flow) rather than one endpoint, so a failed save after a successful upload
 * can be retried without re-uploading the file.
 */

import { AUTH_BASE } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';
import { SHOP_TOKEN_KEY } from '@/lib/shopAuth';

function base() {
  return String(AUTH_BASE() || '').replace(/\/$/, '');
}

/** The authenticated owner's live profile — avatarUrl, name, shop list, etc. */
export async function fetchMyProfile() {
  return shopRequest(base(), '/auth/me');
}

/** Uploads an image to S3 and returns its public URL. Does not persist it — call saveMyAvatar() next. */
export async function uploadMyAvatar(file) {
  const fd = new FormData();
  fd.append('type', 'avatar');
  fd.append('file', file);
  const token = typeof window !== 'undefined' ? window.localStorage.getItem(SHOP_TOKEN_KEY) : null;
  const res = await fetch(`${base()}/auth/me/kyc-documents/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  const data = await res.json().catch(() => ({}));
  if (!data?.url) throw new Error('Upload succeeded but no URL was returned.');
  return data.url;
}

/** Persists a previously-uploaded avatar URL onto the owner's account. Returns the refreshed profile. */
export async function saveMyAvatar(avatarUrl) {
  return shopRequest(base(), '/auth/me/avatar', {
    method: 'PUT',
    body: JSON.stringify({ avatarUrl }),
  });
}

/**
 * Partial update of name and/or personal address. Pass only the fields you
 * want to change — e.g. updateMyProfile({ name }) or
 * updateMyProfile({ addrState, addrDistrict, ... }). Returns the refreshed profile.
 */
export async function updateMyProfile(fields) {
  return shopRequest(base(), '/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(fields || {}),
  });
}

/** Sends an OTP to a NEW email address to verify before it becomes the login email. */
export async function sendChangeEmailOtp(email) {
  return shopRequest(base(), '/auth/me/email/otp/send', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/** Verifies the email-change OTP and persists the new email. Returns the refreshed profile. */
export async function verifyChangeEmailOtp(email, otp) {
  return shopRequest(base(), '/auth/me/email/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  });
}

/** "Sends" the mobile-change OTP (always 123456 — no SMS gateway exists yet). */
export async function sendChangeMobileOtp(mobile) {
  return shopRequest(base(), '/auth/me/mobile/otp/send', {
    method: 'POST',
    body: JSON.stringify({ mobile }),
  });
}

/** Verifies the mobile-change OTP and persists the new number. Returns the refreshed profile. */
export async function verifyChangeMobileOtp(mobile, otp) {
  return shopRequest(base(), '/auth/me/mobile/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ mobile, otp }),
  });
}
