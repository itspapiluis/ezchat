import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import StaffLogin from './staff/StaffLogin.jsx'
import Kitchen from './staff/Kitchen.jsx'
import Bar from './staff/Bar.jsx'
import Cashier from './staff/Cashier.jsx'
import { loadStaffSession } from './staff/shared.js'

function ProtectedRoute({ children, allowedRole }){
  const role = loadStaffSession();
  if(!role) return <Navigate to="/staff" replace/>;
  if(allowedRole && role !== allowedRole && role !== "admin") return <Navigate to="/staff" replace/>;
  return children;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App/>}/>
        <Route path="/staff" element={<StaffLogin/>}/>
        <Route path="/kitchen" element={
          <ProtectedRoute allowedRole="kitchen"><Kitchen/></ProtectedRoute>
        }/>
        <Route path="/bar" element={
          <ProtectedRoute allowedRole="bar"><Bar/></ProtectedRoute>
        }/>
        <Route path="/cashier" element={
          <ProtectedRoute allowedRole="cashier"><Cashier/></ProtectedRoute>
        }/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
