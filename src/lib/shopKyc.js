/**
 * shopKyc.js — the shop owner's own KYC documents (Aadhar front/back + PAN),
 * shown in the "KYC Document" tab of /shop-home/account/settings.
 *
 * Owner-scoped self-service routes on auth-service, the same ones the mobile
 * app's KYC upload screen uses — see AuthController.myKycDocuments /
 * saveMyKycDocuments and OwnerMediaController.uploadOwnerDocument:
 *   GET  {AUTH_BASE}/auth/me/kyc-documents         -> KycDocument
 *   POST {AUTH_BASE}/auth/me/kyc-documents          { aadharFrontUrl, aadharBackUrl, panUrl }
 *        -> KycDocument (any non-null field flips status back to PENDING_REVIEW
 *           and clears a prior rejection — a null field is left untouched)
 *   POST {AUTH_BASE}/auth/me/kyc-documents/upload    (multipart: type, file)
 *        -> { url }   type: aadhaar-front | aadhaar-back | pan
 *
 * Upload and save are deliberately separate calls, same reasoning as the
 * avatar flow in shopProfile.js: uploading each document just gets its S3
 * URL into local state, and nothing is persisted (or flips the review
 * status) until the owner explicitly submits.
 */

import { AUTH_BASE } from '@/lib/api';
import { shopRequest } from '@/lib/shopApi';
import { SHOP_TOKEN_KEY } from '@/lib/shopAuth';

function base() {
  return String(AUTH_BASE() || '').replace(/\/$/, '');
}

/** The signed-in owner's KYC blob — never null; an empty object when nothing submitted yet. */
export async function fetchMyKyc() {
  return shopRequest(base(), '/auth/me/kyc-documents');
}

/** Persist one or more document URLs. Omit a field (undefined) to leave it untouched. */
export async function saveMyKyc({ aadharFrontUrl, aadharBackUrl, panUrl } = {}) {
  const body = {};
  if (aadharFrontUrl !== undefined) body.aadharFrontUrl = aadharFrontUrl;
  if (aadharBackUrl !== undefined) body.aadharBackUrl = aadharBackUrl;
  if (panUrl !== undefined) body.panUrl = panUrl;
  return shopRequest(base(), '/auth/me/kyc-documents', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Uploads one KYC file (type: 'aadhaar-front' | 'aadhaar-back' | 'pan') and returns its public URL. */
export async function uploadMyKycFile(file, type) {
  if (!file) return null;
  const fd = new FormData();
  fd.append('type', type);
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
