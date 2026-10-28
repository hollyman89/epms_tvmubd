import { useSyncExternalStore } from 'react';

export type UploadTaskStatus = 'UPLOADING' | 'SUCCESS' | 'FAILED';

export interface UploadTask {
  id: string;
  fileName: string;
  fileSize?: number;
  flowLabel: string;
  status: UploadTaskStatus;
  progress?: number; // 0..100 integer
  error?: string;
  file?: File;
  retryAction?: () => Promise<void>;
  createdAt: number;
  updatedAt: number;
}

export interface StartUploadTaskOptions<T = any> {
  id?: string;
  fileName: string;
  fileSize?: number;
  flowLabel: string;
  file?: File;
  uploadFn: (onProgress: (progressEvent: any) => void) => Promise<T>;
  onSuccess?: (result: T) => Promise<void> | void;
  onError?: (error: any) => Promise<void> | void;
  autoDismissSuccessDelayMs?: number;
}

const DEFAULT_SUCCESS_DISMISS_MS = 6000;

class UploadTaskManagerStore {
  private tasks: UploadTask[] = [];
  private listeners: Set<() => void> = new Set();
  private dismissTimers: Map<string, any> = new Map();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('[UploadTaskManager] Listener error:', err);
      }
    });
  }

  getSnapshot = (): UploadTask[] => {
    return this.tasks;
  };

  getTasks(): UploadTask[] {
    return [...this.tasks];
  }

  getTask(id: string): UploadTask | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  dismissTask = (id: string): void => {
    const timer = this.dismissTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.dismissTimers.delete(id);
    }
    const prevCount = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.tasks.length !== prevCount) {
      this.notify();
    }
  };

  clearTasks(): void {
    this.dismissTimers.forEach((timer) => clearTimeout(timer));
    this.dismissTimers.clear();
    this.tasks = [];
    this.notify();
  }

  private updateTask(id: string, updates: Partial<UploadTask>) {
    let changed = false;
    this.tasks = this.tasks.map((task) => {
      if (task.id === id) {
        changed = true;
        return {
          ...task,
          ...updates,
          updatedAt: Date.now(),
        };
      }
      return task;
    });
    if (changed) {
      this.notify();
    }
  }

  startUploadTask = <T = any>(options: StartUploadTaskOptions<T>): string => {
    const {
      id: customId,
      fileName,
      fileSize,
      flowLabel,
      file,
      uploadFn,
      onSuccess,
      onError,
      autoDismissSuccessDelayMs = DEFAULT_SUCCESS_DISMISS_MS,
    } = options;

    const taskId =
      customId || `upload-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Cancel any existing dismiss timer for this ID
    if (this.dismissTimers.has(taskId)) {
      clearTimeout(this.dismissTimers.get(taskId));
      this.dismissTimers.delete(taskId);
    }

    // Set up retry action closure
    const runExecution = async () => {
      // Set to UPLOADING and clear errors
      this.updateTask(taskId, {
        status: 'UPLOADING',
        progress: 0,
        error: undefined,
      });

      const onProgress = (progressEvent: any) => {
        if (progressEvent && typeof progressEvent.loaded === 'number') {
          if (typeof progressEvent.total === 'number' && progressEvent.total > 0) {
            const percent = Math.min(
              100,
              Math.max(0, Math.round((progressEvent.loaded * 100) / progressEvent.total)),
            );
            this.updateTask(taskId, { progress: percent });
          } else {
            // Indeterminate total
            this.updateTask(taskId, { progress: undefined });
          }
        }
      };

      try {
        const result = await uploadFn(onProgress);

        // Update task to SUCCESS
        this.updateTask(taskId, {
          status: 'SUCCESS',
          progress: 100,
          error: undefined,
        });

        // Execute post-upload business continuation
        if (onSuccess) {
          try {
            await onSuccess(result);
          } catch (businessErr: any) {
            console.error('[UploadTaskManager] Post-upload success handler error:', businessErr);
          }
        }

        // Schedule auto-dismiss
        if (autoDismissSuccessDelayMs > 0) {
          const timer = setTimeout(() => {
            this.dismissTask(taskId);
          }, autoDismissSuccessDelayMs);
          this.dismissTimers.set(taskId, timer);
        }
      } catch (err: any) {
        const errMsg =
          err?.response?.data?.message ||
          err?.message ||
          'Pengunggahan berkas gagal karena kendala jaringan.';

        this.updateTask(taskId, {
          status: 'FAILED',
          error: errMsg,
        });

        if (onError) {
          try {
            await onError(err);
          } catch (handlerErr) {
            console.error('[UploadTaskManager] Error handler error:', handlerErr);
          }
        }
      }
    };

    // Register initial task
    const newTask: UploadTask = {
      id: taskId,
      fileName,
      fileSize: fileSize ?? file?.size,
      flowLabel,
      status: 'UPLOADING',
      progress: 0,
      file,
      retryAction: runExecution,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Replace if existing, or prepend
    const existingIndex = this.tasks.findIndex((t) => t.id === taskId);
    if (existingIndex >= 0) {
      this.tasks[existingIndex] = newTask;
    } else {
      this.tasks = [newTask, ...this.tasks];
    }
    this.notify();

    // Trigger execution asynchronously without blocking caller
    runExecution();

    return taskId;
  };

  retryTask = async (id: string): Promise<void> => {
    const task = this.getTask(id);
    if (!task) {
      console.warn(`[UploadTaskManager] Task ${id} not found for retry.`);
      return;
    }

    if (task.status === 'UPLOADING') {
      console.warn(`[UploadTaskManager] Task ${id} is already uploading. Concurrent retry blocked.`);
      return;
    }

    if (!task.retryAction) {
      console.warn(`[UploadTaskManager] Task ${id} has no retryAction registered.`);
      return;
    }

    await task.retryAction();
  };
}

export const uploadTaskManager = new UploadTaskManagerStore();

const emptyTasks: UploadTask[] = [];

export function useUploadTasks() {
  const tasks = useSyncExternalStore(
    uploadTaskManager.subscribe,
    uploadTaskManager.getSnapshot,
    () => emptyTasks,
  );

  return {
    tasks,
    startUploadTask: uploadTaskManager.startUploadTask,
    retryTask: uploadTaskManager.retryTask,
    dismissTask: uploadTaskManager.dismissTask,
    clearTasks: uploadTaskManager.clearTasks.bind(uploadTaskManager),
  };
}
