import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import AdminLive from './pages/AdminLive'
import AuthCallback from './pages/AuthCallback'
import Catalog from './pages/Catalog'
import GuestLive from './pages/GuestLive'
import Home from './pages/Home'
import Filleuls from './pages/Filleuls'
import Profile from './pages/Profile'
import SubscriptionReturn from './pages/SubscriptionReturn'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/admin" element={<AdminLive />} />
        <Route path="/live/:shareCode" element={<GuestLive />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/filleuls" element={<Filleuls />} />
        <Route path="/subscriptions/:subscriptionId/return" element={<SubscriptionReturn />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
