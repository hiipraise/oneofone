import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const location = useLocation()

  // Auto-close sidebar on mobile after any navigation
  useEffect(() => {
    setIsSidebarOpen(false)
  }, [location.pathname, location.search])

  return (
    <div className="h-screen bg-brand-black overflow-hidden">
      {/* Navbar now receives toggle prop (see note below) */}
      <Navbar toggleSidebar={() => setIsSidebarOpen(prev => !prev)} />

      <div className="flex h-[calc(100vh-53px)] relative">
        {/* Sidebar (now responsive) */}
        <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)} 
        />

        {/* Mobile backdrop */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/70 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main content – responsive margin */}
        <main className="flex-1 md:ml-56 h-full overflow-y-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
