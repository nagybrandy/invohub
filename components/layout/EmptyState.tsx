// components/layout/EmptyState.tsx
// Thin backward-compatible wrapper around StateView (V11) — existing calls
// with the old { title, description, action, loading, className } shape
// keep working unchanged, but loading now renders a skeleton instead of an
// ActivityIndicator floating in the void.
import type { ReactNode } from "react";
import { StateView } from "@/components/layout/StateView";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  loading?: boolean;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  loading = false,
  className,
}: EmptyStateProps) {
  if (loading) {
    return <StateView kind="loading" className={className} />;
  }
  return (
    <StateView
      kind="empty"
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}
