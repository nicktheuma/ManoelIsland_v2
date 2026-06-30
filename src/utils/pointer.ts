export const CLICK_DRAG_THRESHOLD_PX = 6

export function isClickGesture(startX: number, startY: number, endX: number, endY: number): boolean {
  return Math.hypot(endX - startX, endY - startY) <= CLICK_DRAG_THRESHOLD_PX
}

export function isTouchPointer(pointerType: string): boolean {
  return pointerType === 'touch' || pointerType === 'pen'
}

export function isCoarsePointerDevice(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
}
