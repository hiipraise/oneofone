// src/components/Layout.jsx
import React from 'react'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="h-screen bg-brand-black overflow-hidden">
      {/* Navbar (fixed height assumed 53px) */}
      <Navbar />

      <div className="flex">
        {/* Sidebar */}
        <Sidebar />

        {/* Main scroll container */}
        <main className="ml-56 h-[calc(100vh-53px)] flex-1 overflow-y-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}