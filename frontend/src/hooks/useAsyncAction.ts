/**
 * Hook for async actions with automatic loading, error handling, and toast notifications
 * Use this to replace manual try/catch patterns in components
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/errors';
import { logComponentError } from '@/lib/logger';

interface UseAsyncActionOptions {
  /** Component name for logging */
  component?: string;
  /** Message to show on success */
  successMessage?: string;
  /** Message to show on error (will be followed by actual error) */
  errorMessage?: string;
  /** Callback on success */
  onSuccess?: () => void;
  /** Callback on error */
  onError?: (error: unknown) => void;
  /** Whether to show toast on success */
  showSuccessToast?: boolean;
  /** Whether to show toast on error */
  showErrorToast?: boolean;
  /** Prevent concurrent executions */
  preventConcurrent?: boolean;
}

interface AsyncActionState {
  isLoading: boolean;
  error: string | null;
  lastSuccess: boolean | null;
}

type AsyncAction<TArgs extends unknown[], TResult = void> = (
  ...args: TArgs
) => Promise<TResult | undefined>;

interface UseAsyncActionReturn<TArgs extends unknown[], TResult = void> {
  execute: AsyncAction<TArgs, TResult>;
  isLoading: boolean;
  error: string | null;
  lastSuccess: boolean | null;
  reset: () => void;
}

/**
 * Hook for handling async actions with loading states and error handling
 * 
 * @example
 * ```tsx
 * const { execute, isLoading, error } = useAsyncAction(
 *   async (id: string) => {
 *     await api.deleteProject(id);
 *   },
 *   {
 *     component: 'ProjectCard',
 *     successMessage: 'Progetto eliminato',
 *     errorMessage: 'Errore eliminazione progetto',
 *   }
 * );
 * 
 * <Button onClick={() => execute(project.id)} disabled={isLoading}>
 *   {isLoading ? 'Eliminazione...' : 'Elimina'}
 * </Button>
 * ```
 */
export function useAsyncAction<TArgs extends unknown[], TResult = void>(
  action: (...args: TArgs) => Promise<TResult>,
  options: UseAsyncActionOptions = {}
): UseAsyncActionReturn<TArgs, TResult> {
  const {
    component,
    successMessage,
    errorMessage,
    onSuccess,
    onError,
    showSuccessToast = true,
    showErrorToast = true,
    preventConcurrent = true,
  } = options;

  const [state, setState] = useState<AsyncActionState>({
    isLoading: false,
    error: null,
    lastSuccess: null,
  });

  const isExecutingRef = useRef(false);

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      // Prevent concurrent executions if enabled
      if (preventConcurrent && isExecutingRef.current) {
        return undefined;
      }

      isExecutingRef.current = true;
      setState({ isLoading: true, error: null, lastSuccess: null });

      try {
        const result = await action(...args);

        setState({ isLoading: false, error: null, lastSuccess: true });

        if (successMessage && showSuccessToast) {
          toast.success(successMessage);
        }

        onSuccess?.();

        return result;
      } catch (error: unknown) {
        const message = getErrorMessage(error);

        setState({ isLoading: false, error: message, lastSuccess: false });

        if (component) {
          logComponentError(error, component);
        }

        if (showErrorToast) {
          if (errorMessage) {
            toast.error(errorMessage, { description: message });
          } else {
            toast.error(message);
          }
        }

        onError?.(error);

        return undefined;
      } finally {
        isExecutingRef.current = false;
      }
    },
    [
      action,
      component,
      successMessage,
      errorMessage,
      onSuccess,
      onError,
      showSuccessToast,
      showErrorToast,
      preventConcurrent,
    ]
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, lastSuccess: null });
  }, []);

  return {
    execute,
    isLoading: state.isLoading,
    error: state.error,
    lastSuccess: state.lastSuccess,
    reset,
  };
}

/**
 * Simplified version for actions that don't need return values
 * Returns just the execute function and loading state as a tuple
 */
export function useSimpleAsyncAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<void>,
  options: UseAsyncActionOptions = {}
): [(...args: TArgs) => Promise<void>, boolean] {
  const { execute, isLoading } = useAsyncAction(action, options);
  return [execute as (...args: TArgs) => Promise<void>, isLoading];
}

/**
 * Hook for confirmation dialogs with async actions
 */
export function useConfirmAction<TArgs extends unknown[]>(
  action: (...args: TArgs) => Promise<void>,
  options: UseAsyncActionOptions & {
    confirmTitle?: string;
    confirmMessage?: string;
  } = {}
) {
  const { execute, isLoading, error, reset } = useAsyncAction(action, options);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const pendingArgsRef = useRef<TArgs | null>(null);

  const requestConfirm = useCallback((...args: TArgs) => {
    pendingArgsRef.current = args;
    setIsConfirmOpen(true);
  }, []);

  const confirm = useCallback(async () => {
    if (pendingArgsRef.current) {
      await execute(...pendingArgsRef.current);
      pendingArgsRef.current = null;
    }
    setIsConfirmOpen(false);
  }, [execute]);

  const cancel = useCallback(() => {
    pendingArgsRef.current = null;
    setIsConfirmOpen(false);
  }, []);

  return {
    requestConfirm,
    confirm,
    cancel,
    isConfirmOpen,
    isLoading,
    error,
    reset,
    confirmTitle: options.confirmTitle,
    confirmMessage: options.confirmMessage,
  };
}

export default useAsyncAction;
