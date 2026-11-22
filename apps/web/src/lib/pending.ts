export function isPending(body: unknown): boolean {
  return Boolean(body && typeof body === 'object' && 'pending' in body && (body as { pending?: boolean }).pending)
}

export function ownerQuery(ownerId?: string) {
  return ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : ''
}
