/**
 * Upload provider abstraction (deferred).
 *
 * Originally targeted v0.6; cloud upload is now Beyond — the project is
 * local-first. This file is kept as a small interface so a future
 * implementation has a place to land. Do not wire it up to UI without
 * a roadmap update.
 */

export interface UploadProgress {
  bytes: number;
  total: number;
}

export interface UploadInput {
  filePath: string;
  contentType: string;
  /** Optional preferred remote object key — provider may transform it. */
  preferredKey?: string;
}

export interface UploadResult {
  remoteUrl: string;
  shortUrl?: string;
  provider: string;
}

export interface UploadProvider {
  readonly id: string;
  readonly displayName: string;
  upload(input: UploadInput, onProgress?: (p: UploadProgress) => void): Promise<UploadResult>;
}

const providers = new Map<string, UploadProvider>();

export function registerProvider(p: UploadProvider): void {
  providers.set(p.id, p);
}

export function getProvider(id: string): UploadProvider | undefined {
  return providers.get(id);
}

export function listProviders(): UploadProvider[] {
  return Array.from(providers.values());
}
