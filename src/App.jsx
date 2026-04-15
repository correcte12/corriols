import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ChallengeDetailPage from './pages/ChallengeDetailPage'
import RankingPage from './pages/RankingPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import GalleryPage from './pages/GalleryPage'
import GalleryAdminPage from './pages/GalleryAdminPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reto/:id" element={<ChallengeDetailPage />} />
            <Route path="/ranking/:id" element={<RankingPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/galeria" element={<GalleryPage />} />
            <Route path="/galeria/:albumSlug" element={<GalleryPage />} />
            <Route path="/admin/galeria" element={<GalleryAdminPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  )
}
