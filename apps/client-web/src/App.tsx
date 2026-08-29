import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/register"
            element={<PlaceholderPage title="Créer un compte" source="admin-web/src/client/ClientAuth.tsx" />}
          />
          <Route
            path="/forgot-password"
            element={
              <PlaceholderPage title="Mot de passe oublié" source="admin-web/src/client/ClientAuth.tsx" />
            }
          />

          {/* Authentifié */}
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<HomePage />} />
            <Route
              path="booking"
              element={
                <PlaceholderPage title="Nouvelle réservation" source="admin-web/src/client/ClientBooking.tsx" />
              }
            />
            <Route
              path="status/:id"
              element={
                <PlaceholderPage title="Suivi de la réservation" source="admin-web/src/client/ClientStatus.tsx" />
              }
            />
            <Route
              path="profile"
              element={<PlaceholderPage title="Mon profil" source="apps/mobile/.../client_profile_screen.dart" />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
