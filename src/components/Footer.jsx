import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">

        <div className="footer-top">
          {/* Marca */}
          <div className="footer-brand">
            <div className="footer-logo">
              <img src="/logo.png" alt="Corriols" className="footer-logo-img" />
              Corriols de l'Empordà
            </div>
            <p className="footer-tagline">
              Plataforma de reptes esportius de muntanya per a la comunitat de l'Empordà i els Pirineus.
              Completa cims, acumula quilòmetres i desnivell.
            </p>
          </div>

          {/* Comunitat — placeholder, sense links */}
          <div className="footer-col">
            <h3 className="footer-col-title">Comunitat</h3>
            <ul className="footer-links">
              <li><Link to="/" className="footer-nav-link">Reptes actius</Link></li>
              <li><Link to="/galeria" className="footer-nav-link">Galeria</Link></li>
              <li><Link to="/perfil" className="footer-nav-link">El meu progrés</Link></li>
            </ul>
          </div>

          {/* Suport — placeholder */}
          <div className="footer-col">
            <h3 className="footer-col-title">Suport</h3>
            <ul className="footer-links">
              <li>Ajuda</li>
              <li>Privacitat</li>
              <li>Contacte</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Corriols de l'Empordà. Tots els drets reservats.</p>
          <div className="footer-bottom-links">
            <a href="https://ca.wikiloc.com/wikiloc/user.do?id=68131" target="_blank" rel="noopener noreferrer">
              <img src="/wikiloc-icon.png" alt="Wikiloc" className="footer-social-icon" />
              Wikiloc
            </a>
            <a href="https://www.instagram.com/carlosmorenotihista/" target="_blank" rel="noopener noreferrer">
              <img src="/instagram-icon.png" alt="Instagram" className="footer-social-icon" />
              Instagram
            </a>
          </div>
        </div>

      </div>
    </footer>
  )
}
