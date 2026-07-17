import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import StaffLogin from './staff/StaffLogin.jsx'
import Kitchen from './staff/Kitchen.jsx'
import Bar from './staff/Bar.jsx'
import Cashier from './staff/Cashier.jsx'
import Server from './staff/Server.jsx'
import { hasStaffRole } from './staff/shared.js'

// BUGFIX: this used to read ONE stored role and compare it. With Kitchen open in
// one tab and Bar in another, the stored role was whichever logged in last — so
// the other tab got kicked to /staff on its next re-render. Now each route asks
// only: "is this browser authorised for MY role?"
function ProtectedRoute({ children, allowedRole }){
  if(!hasStaffRole(allowedRole)) return <Navigate to="/staff" replace/>;
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
        <Route path="/server" element={
          <ProtectedRoute allowedRole="server"><Server/></ProtectedRoute>
        }/>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
