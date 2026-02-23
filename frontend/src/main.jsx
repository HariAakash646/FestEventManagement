import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { ChakraProvider, defaultSystem } from '@chakra-ui/react'
import { BrowserRouter } from "react-router-dom"
import { AuthProvider } from './context/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <ChakraProvider value={defaultSystem}>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </ChakraProvider>
        </BrowserRouter>
    </StrictMode>
)
