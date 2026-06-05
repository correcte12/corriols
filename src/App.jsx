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
import ExcursionsPage from './pages/ExcursionsPage'
import GpxToolPage from './pages/GpxToolPage'
import GpxEditPage from './pages/GpxEditPage'
import BlogPage from './pages/BlogPage'
import ArticlePage from './pages/ArticlePage'
import BlogAdminPage from './pages/BlogAdminPage'
import { GpxSessionProvider } from './hooks/useGpxSession.jsx'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <GpxSessionProvider>
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
            <Route path="/excursions" element={<ExcursionsPage />} />
            <Route path="/gpx" element={<GpxToolPage />} />
            <Route path="/gpx/editar/:id" element={<GpxEditPage />} />
            <Route path="/blog" element={<BlogPage />} />
            <Route path="/blog/:slug" element={<ArticlePage />} />
            <Route path="/admin/blog" element={<BlogAdminPage />} />
          </Routes>
        </Layout>
        </GpxSessionProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
