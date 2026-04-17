import { createContext,useState } from "react";


export const InterviewContext = createContext()

export const InterviewProvider = ({ children }) => {
    const [loading, setLoading] = useState(false)
    const [report, setReport] = useState(null)
    const [reports, setReports] = useState([])
    const [resumeLoading, setResumeLoading] = useState(false)

    return (
        <InterviewContext.Provider value={{ loading, setLoading,resumeLoading,
      setResumeLoading, report, setReport, reports, setReports }}>
            {children}
        </InterviewContext.Provider>
    )
}