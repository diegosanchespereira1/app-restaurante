import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { Layout } from "./components/layout/Layout"
import { Dashboard } from "./pages/Dashboard"
import { Orders } from "./pages/Orders"
import { NewOrder } from "./pages/NewOrder"
import { OrderDetails } from "./pages/OrderDetails"
import { Tables } from "./pages/Tables"
import { TableDetails } from "./pages/TableDetails"
import { Menu } from "./pages/Menu"
import { Settings } from "./pages/Settings"
import { Finance } from "./pages/Finance"
import { SalesChart } from "./pages/SalesChart"
import { OrderDisplay } from "./pages/OrderDisplay"
import { OrderDisplayStandalone } from "./pages/OrderDisplayStandalone"
import { Login } from "./pages/Login"

import { RestaurantProvider } from "./context/RestaurantContext"
import { LanguageProvider } from "./context/LanguageContext"
import { SettingsProvider } from "./context/SettingsContext"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { StockProvider } from "./context/StockContext"
import { ProtectedRoute } from "./components/auth/ProtectedRoute"

import { TableBill } from "./pages/TableBill"
import { Stock } from "./pages/Stock"
import { AddInventoryItem } from "./pages/AddInventoryItem"
import { EditInventoryItem } from "./pages/EditInventoryItem"

// Component to handle authenticated routes
function AuthenticatedRoutes() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/new" element={<NewOrder />} />
        <Route path="/orders/:id" element={<OrderDetails />} />
        <Route 
          path="/finance" 
          element={
            <ProtectedRoute requiredRole={['admin', 'gerente']}>
              <Finance />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sales" 
          element={
            <ProtectedRoute requiredRole={['admin', 'gerente']}>
              <SalesChart />
            </ProtectedRoute>
          } 
        />
        <Route path="/tables" element={<Tables />} />
        <Route path="/tables/:id" element={<TableDetails />} />
        <Route path="/tables/:id/bill" element={<TableBill />} />
        <Route path="/menu" element={<Menu />} />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute requiredRole={['admin', 'gerente']}>
              <Settings />
            </ProtectedRoute>
          } 
        />
        <Route path="/order-display" element={<OrderDisplay />} />
        <Route 
          path="/stock" 
          element={
            <ProtectedRoute requiredRole="admin">
              <Stock />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/stock/add" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AddInventoryItem />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/stock/edit/:id" 
          element={
            <ProtectedRoute requiredRole="admin">
              <EditInventoryItem />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <SettingsProvider>
      <LanguageProvider>
        <AuthProvider>
          <StockProvider>
            <RestaurantProvider>
              <Router>
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  
                  {/* Standalone route without Layout wrapper */}
                  <Route path="/order-display-standalone" element={<OrderDisplayStandalone />} />
                  
                  {/* All authenticated routes with Layout wrapper */}
                  <Route path="/*" element={<AuthenticatedRoutes />} />
                </Routes>
              </Router>
            </RestaurantProvider>
          </StockProvider>
        </AuthProvider>
      </LanguageProvider>
    </SettingsProvider>
  )
}

export default App
