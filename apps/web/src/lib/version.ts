export const APP_VERSION = '1.0.0'

export function isStaff(role?: string) {
  return role === 'admin' || role === 'super_admin'
}

export function isSuper(role?: string) {
  return role === 'super_admin'
}
