import { AuthProvider } from '@/features/auth/AuthContext';
import { BrowserRouter } from 'react-router';
import { AppRoutes } from '@/routes';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
