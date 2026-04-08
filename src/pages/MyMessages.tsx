import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';


export default function MyMessages() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/messages', { replace: true });
  }, []);
  return null;
}
