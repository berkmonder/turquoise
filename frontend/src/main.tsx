import { createRoot } from "react-dom/client";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { Anomaly } from "./pages/Anomaly";
import { ApiPage } from "./pages/ApiPage";
import { Ask } from "./pages/Ask";
import { Home } from "./pages/Home";
import "./styles.css";

function App() {
  return (
    <BrowserRouter>
      <header className="top">
        <NavLink to="/" className="brand">
          <span className="logo" /> turquoise
        </NavLink>
        <nav>
          <NavLink to="/ask">Ask about Berk</NavLink>
          <NavLink to="/anomaly">Anomaly detection</NavLink>
          <NavLink to="/developers">API</NavLink>
          <a href="https://berkmonder.com">berkmonder.com</a>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ask" element={<Ask />} />
          <Route path="/anomaly" element={<Anomaly />} />
          <Route path="/developers" element={<ApiPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
