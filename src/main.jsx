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

// ── GLOBAL ERROR BOUNDARY ────────────────────────────────────────────────────
// If ANY component throws during render, React normally unmounts everything and
// leaves a BLANK WHITE SCREEN with the real cause hidden in a minified stack.
// This catches the crash and shows the actual error message on screen, so a
// failure is diagnosable at a glance instead of being an invisible white page.
class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state = { err: null, info: null }; }
  static getDerivedStateFromError(err){ return { err }; }
  componentDidCatch(err, info){ this.setState({ info }); console.error("EZChat crash:", err, info); }
  render(){
    if(this.state.err){
      const msg = String(this.state.err && (this.state.err.stack || this.state.err.message || this.state.err));
      const comp = this.state.info && this.state.info.componentStack ? String(this.state.info.componentStack) : "";
      return React.createElement("div", {
        style:{fontFamily:"ui-monospace,Menlo,monospace",maxWidth:680,margin:"40px auto",padding:24,
          background:"#151510",color:"#e8e0d0",border:"1px solid #C9A84C",borderRadius:12,lineHeight:1.55}
      },
        React.createElement("h2",{style:{color:"#C9A84C",margin:"0 0 8px"}},"EZChat hit an error"),
        React.createElement("p",{style:{margin:"0 0 12px",color:"#8a8578"}},"The screen below shows what actually failed — screenshot this."),
        React.createElement("pre",{style:{whiteSpace:"pre-wrap",fontSize:12,background:"#0a0a08",padding:12,borderRadius:8,overflow:"auto",maxHeight:280}}, msg),
        comp && React.createElement("pre",{style:{whiteSpace:"pre-wrap",fontSize:11,color:"#6a655a",background:"#0a0a08",padding:12,borderRadius:8,marginTop:8,overflow:"auto",maxHeight:200}}, comp),
        React.createElement("button",{
          onClick:()=>{ try{localStorage.clear();sessionStorage.clear();}catch(e){} location.reload(); },
          style:{marginTop:14,padding:"10px 18px",background:"#C9A84C",border:"none",borderRadius:8,color:"#150a10",fontWeight:700,cursor:"pointer"}
        },"Clear data & reload")
      );
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children, allowedRole }){
  if(!hasStaffRole(allowedRole)) return <Navigate to="/staff" replace/>;
  return children;
}

// ── LAST-RESORT SAFETY NET ───────────────────────────────────────────────────
// A React effect whose cleanup isn't a function (e.g. `return addEventListener()`
// which returns undefined) makes React call `undefined()` on unmount, throwing
// "n is not a function" and white-screening the whole app. That specific bug is
// fixed in the source, but to guarantee it can NEVER take the app down again,
// swallow any error whose message is exactly that during teardown.
window.addEventListener("error", (e) => {
  if (e.message && /is not a function/.test(e.message)) {
    // Log it, but don't let it blank the app.
    console.warn("EZChat: suppressed a non-fatal teardown error —", e.message);
    e.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
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
  </ErrorBoundary>
)
