import { HashRouter as Router, Routes, Route } from "react-router-dom"
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

import { RestaurantProvider } from "./context/RestaurantContext"
import { LanguageProvider } from "./context/LanguageContext"
import { SettingsProvider } from "./context/SettingsContext"

import { TableBill } from "./pages/TableBill"

function App() {
  return (
    <SettingsProvider>
      <LanguageProvider>
        <RestaurantProvider>
          <Router>
            <Routes>
              {/* Standalone route without Layout wrapper */}
              <Route path="/order-display-standalone" element={<OrderDisplayStandalone />} />
              
              {/* All other routes with Layout wrapper */}
              <Route path="/*" element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/orders/new" element={<NewOrder />} />
                    <Route path="/orders/:id" element={<OrderDetails />} />
                    <Route path="/finance" element={<Finance />} />
                    <Route path="/sales" element={<SalesChart />} />
                    <Route path="/tables" element={<Tables />} />
                    <Route path="/tables/:id" element={<TableDetails />} />
                    <Route path="/tables/:id/bill" element={<TableBill />} />
                    <Route path="/menu" element={<Menu />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/order-display" element={<OrderDisplay />} />
                  </Routes>
                </Layout>
              } />
            </Routes>
          </Router>
        </RestaurantProvider>
      </LanguageProvider>
    </SettingsProvider>
  )
}

export default App
