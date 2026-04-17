import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router";
import React from 'react'
import LoadingIndicator from '../../../components/LoadingIndicator'

const Protected = ({children}) => {
    const { loading,user } = useAuth()


    if(loading){
        return ( <main className="loading-screen">
      <LoadingIndicator />
    </main>)
    }

    if(!user){
        return <Navigate to={'/login'} />
    }
    
    return children
}

export default Protected