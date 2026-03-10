import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Legacy redirect — /my-messages now lives at /messages.
 * Any old bookmarks or deep links will land here and be instantly forwarded.
 */
export default function MyMessages() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/messages', { replace: true });
  }, []);
  return null;
}
