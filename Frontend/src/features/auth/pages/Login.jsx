import React,{useState} from 'react'
import { useNavigate, Link } from 'react-router'
import "../auth.form.scss"
import { useAuth } from '../hooks/useAuth'
import LoadingIndicator from '../../../components/LoadingIndicator'

const Login = () => {

    const { loading, handleLogin } = useAuth()
    const navigate = useNavigate()

    const [ email, setEmail ] = useState("")
    const [ password, setPassword ] = useState("")
    const [error, setError] = useState("")

    const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    try {
      await handleLogin({ email, password })
      navigate('/')
    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? "Invalid email or password")
    }
  }

    if(loading){
       return (
    <main className="loading-screen">
      <LoadingIndicator />
    </main>
  )
    }


    return (
        <main>
            <div className="form-container">
                 <header className="auth-header">
        <h1>Welcome to PrepAI</h1>
        <p>Sign in to continue preparing for your next interview.</p>
      </header>
                <h1>Login</h1>
                  {error && <div className="error-toast">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Email</label>
                        <input
                            onChange={(e) => { setEmail(e.target.value) }}
                            type="email" id="email" name='email' placeholder='Enter email address' />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            onChange={(e) => { setPassword(e.target.value) }}
                            type="password" id="password" name='password' placeholder='Enter password' />
                    </div>
                    <button className='button primary-button' >Login</button>
                </form>
                <p>Don't have an account? <Link to={"/register"} >Register</Link> </p>
            </div>
        </main>
    )
}

export default Login