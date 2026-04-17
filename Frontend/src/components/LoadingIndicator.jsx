import { FourSquare } from 'react-loading-indicators'
import "./LoadingIndicator.scss"

const LoadingIndicator = ({ text = "" }) => (
  <div className="loading-indicator">
    <FourSquare color="#e1034d" size="medium" text={text} textColor="#e1034d" />
  </div>
)

export default LoadingIndicator