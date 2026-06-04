import React from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import BuilderApp from './App'
import { AuthProvider } from '../auth/AuthContext'

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <BuilderApp />
  </AuthProvider>
)
