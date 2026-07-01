export type UndoCommand = {
  label: string
  undo: () => void | Promise<void>
  redo: () => void | Promise<void>
}

export type UndoStack = {
  past: UndoCommand[]
  future: UndoCommand[]
}

export function createUndoStack(): UndoStack {
  return { past: [], future: [] }
}

export function pushUndoCommand(stack: UndoStack, command: UndoCommand, maxSize = 50): void {
  stack.past.push(command)
  if (stack.past.length > maxSize) stack.past.shift()
  stack.future = []
}

export function undoCommand(stack: UndoStack): UndoCommand | null {
  const command = stack.past.pop()
  if (!command) return null
  stack.future.push(command)
  return command
}

export function redoCommand(stack: UndoStack): UndoCommand | null {
  const command = stack.future.pop()
  if (!command) return null
  stack.past.push(command)
  return command
}

export function canUndoStack(stack: UndoStack): boolean {
  return stack.past.length > 0
}

export function canRedoStack(stack: UndoStack): boolean {
  return stack.future.length > 0
}
