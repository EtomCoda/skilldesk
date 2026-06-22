import { Navigate } from 'react-router-dom';
import { useStore } from '../store/useStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedClientRoute({ children }: ProtectedRouteProps) {
  const { viewMode } = useStore();
  if (viewMode !== 'buying') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function ProtectedFreelancerRoute({ children }: ProtectedRouteProps) {
  const { viewMode } = useStore();
  if (viewMode !== 'selling') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
