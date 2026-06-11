export default function TaskPreviewPanel({ children }) {
  return (
    <div className="te-preview-panel">
      <div className="te-preview-header">
        <span className="te-preview-title">Student preview</span>
      </div>
      {children}
    </div>
  )
}
