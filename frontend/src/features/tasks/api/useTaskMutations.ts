import { useMutation, useQueryClient } from '@tanstack/react-query'

import { completeTask } from './completeTask'
import { createTask } from './createTask'
import { deleteTask } from './deleteTask'
import { reopenTask } from './reopenTask'
import { taskKeys } from './taskKeys'
import { updateTask } from './updateTask'
import type { TaskInput } from '../types/task'

// Every mutation invalidates the whole `tasks` key prefix — a create/edit/
// delete/complete/reopen can all change which rows land on which page or
// which side of the `completed` filter a row falls on. CONVENTIONS.md §23.
function useInvalidateTasks() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: taskKeys.all })
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: TaskInput) => createTask(input),
    onSuccess: invalidate,
  })
}

export function useUpdateTask(id: number) {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (input: TaskInput) => updateTask(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: invalidate,
  })
}

export function useCompleteTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: number) => completeTask(id),
    onSuccess: invalidate,
  })
}

export function useReopenTask() {
  const invalidate = useInvalidateTasks()
  return useMutation({
    mutationFn: (id: number) => reopenTask(id),
    onSuccess: invalidate,
  })
}
