import '../pages/Auth.css'

export default function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">
          plan<span>trip</span>
        </h1>
        {children}
      </div>
    </div>
  )
}
