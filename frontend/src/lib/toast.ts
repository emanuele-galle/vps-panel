import { toast as sonnerToast } from 'sonner';

interface ToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick?: () => void;
  };
}

interface UndoableOptions extends Omit<ToastOptions, 'action'> {
  onUndo: () => void | Promise<void>;
  undoLabel?: string;
}

/**
 * Enhanced toast utility with consistent styling and action support
 */
export const toast = {
  /**
   * Success toast
   */
  success(message: string, options?: ToastOptions) {
    return sonnerToast.success(message, {
      description: options?.description,
      duration: options?.duration ?? 4000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
      cancel: options?.cancel
        ? {
            label: options.cancel.label,
            onClick: options.cancel.onClick ?? (() => {}),
          }
        : undefined,
    });
  },

  /**
   * Error toast
   */
  error(message: string, options?: ToastOptions) {
    return sonnerToast.error(message, {
      description: options?.description,
      duration: options?.duration ?? 6000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },

  /**
   * Info toast
   */
  info(message: string, options?: ToastOptions) {
    return sonnerToast.info(message, {
      description: options?.description,
      duration: options?.duration ?? 4000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },

  /**
   * Warning toast
   */
  warning(message: string, options?: ToastOptions) {
    return sonnerToast.warning(message, {
      description: options?.description,
      duration: options?.duration ?? 5000,
      action: options?.action
        ? {
            label: options.action.label,
            onClick: options.action.onClick,
          }
        : undefined,
    });
  },

  /**
   * Loading toast - returns dismiss function
   */
  loading(message: string, options?: { description?: string }) {
    return sonnerToast.loading(message, {
      description: options?.description,
    });
  },

  /**
   * Promise toast - shows loading, then success/error
   */
  promise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: Error) => string);
    },
    options?: { description?: string }
  ) {
    return sonnerToast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
      description: options?.description,
    });
  },

  /**
   * Success toast with undo action
   */
  undoable(message: string, options: UndoableOptions) {
    return sonnerToast.success(message, {
      description: options.description,
      duration: options.duration ?? 5000,
      action: {
        label: options.undoLabel ?? 'Annulla',
        onClick: async () => {
          try {
            await options.onUndo();
            sonnerToast.success('Azione annullata');
          } catch {
            sonnerToast.error('Impossibile annullare');
          }
        },
      },
    });
  },

  /**
   * Dismiss a specific or all toasts
   */
  dismiss(id?: string | number) {
    sonnerToast.dismiss(id);
  },

  /**
   * Custom toast
   */
  custom(component: React.ReactElement) {
    return sonnerToast.custom(() => component);
  },
};

/**
 * Toast for API operations with automatic loading/success/error states
 */
export async function toastAsync<T>(
  asyncFn: () => Promise<T>,
  messages: {
    loading?: string;
    success?: string;
    error?: string;
  }
): Promise<T | null> {
  const toastId = messages.loading
    ? toast.loading(messages.loading)
    : undefined;

  try {
    const result = await asyncFn();
    toast.dismiss(toastId);
    if (messages.success) {
      toast.success(messages.success);
    }
    return result;
  } catch (error) {
    toast.dismiss(toastId);
    const errorMessage =
      messages.error ??
      (error instanceof Error ? error.message : 'Operazione fallita');
    toast.error(errorMessage);
    return null;
  }
}
