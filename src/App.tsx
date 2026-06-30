import { AdminProvider } from './context/AdminProvider'
import { SandboxProvider } from './context/SandboxProvider'
import { SandboxScene } from './components/SandboxScene'

function App() {
  return (
    <SandboxProvider>
      <AdminProvider>
        <SandboxScene />
      </AdminProvider>
    </SandboxProvider>
  )
}

export default App
