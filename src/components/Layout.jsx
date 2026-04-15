import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Footer from './Footer'
import './Layout.css'

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="layout">
      <header className={`navbar${isHome ? ' navbar-transparent' : ''}`}>
        <Link to="/" className="navbar-brand">
          <img src="/logo.png" alt="Corriols" className="navbar-logo" />
          Corriols de l'Empordà
        </Link>
        <nav className="navbar-links">
          <Link to="/">Reptes</Link>
          <Link to="/galeria">Galeria</Link>
          {user && <Link to="/perfil">El meu perfil</Link>}
          {user && <Link to="/admin">Admin</Link>}
          <a href="https://ca.wikiloc.com/wikiloc/user.do?id=68131" target="_blank" rel="noopener noreferrer" className="navbar-icon-link">
            <img src="/wikiloc-icon.png" alt="Wikiloc" className="navbar-social-icon" />
          </a>
          <a href="https://www.instagram.com/carlosmorenotihista/" target="_blank" rel="noopener noreferrer" className="navbar-icon-link">
            <img src="/instagram-icon.png" alt="Instagram" className="navbar-social-icon" />
          </a>
          {user
            ? <button onClick={handleSignOut}>Sortir</button>
            : <Link to="/login">Entrar</Link>
          }
        </nav>
      </header>

      <main className={`main-content${isHome ? ' full-width' : ''}`}>
        {children}
      </main>
      <Footer />
    </div>
  )
}
